import type { Types } from "mongoose";
import { AuditRun, type AuditRunDoc } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { Rule } from "@/models/rule";
import { EnhancementPoint } from "@/models/enhancement-point";
import { APPLICATION_VERSION, PARSER_VERSION, REQUIREMENTS_VERSION, RULE_ENGINE_VERSION } from "@/lib/audit/version";
import { Stopwatch } from "@/lib/audit/timing";
import { parseThemeZip, ThemeZipError, InvalidThemeError, type ParsedFile } from "@/lib/theme-parser";
import { runAuditRules } from "@/lib/audit";
import { detectEnhancementPoints, type EnhancementDetectionResult } from "@/lib/audit/detectEnhancements";
import { computeAuditDiagnostics } from "@/lib/audit/diagnostics";
import { summarizeFindings, type ExecutedFinding } from "@/lib/audit/runRules";
import { runLiveChecksForPresets } from "@/lib/audit/liveChecks/runLiveChecks";
import type { PresetLink } from "@/lib/audit/liveChecks/shared";
import { runPageSpeedChecksForPresets, type PageSpeedMetric } from "@/lib/audit/pageSpeed";
import { classifyFindingHistory, type CarriedFinding, type HistoryClassification } from "@/lib/audit/findingHistory";
import type { DiffableFinding } from "@/lib/audit/findingSignature";
import type { AuditStageKey } from "@/lib/audit/progress";

const SNIPPET_CONTEXT_LINES = 3;

// A lightweight, isolated field update — deliberately not touching the
// in-memory `auditRun` object other callers accumulate fields onto, so it
// never races with (or gets clobbered by) the single big auditRun.save()
// at the very end. Swallows its own errors: a progress-tracking write
// failing must never fail the actual audit.
async function setStage(auditRunId: unknown, stage: AuditStageKey, stageProgress?: { completed: number; total: number }): Promise<void> {
  try {
    await AuditRun.updateOne({ _id: auditRunId }, { $set: { currentStage: stage, ...(stageProgress ? { stageProgress } : {}) } });
  } catch {
    // Best-effort only.
  }
}

/**
 * Snapshots every rule's current version onto this audit run (phase-6
 * §14) — cheap and complete (all rules, not just enabled ones) rather
 * than trying to guess which will matter later. Lets a later diff tell
 * "this finding is new because a rule was added or changed" apart from
 * "this finding is new because the theme actually changed".
 */
async function captureRuleVersionSnapshot(): Promise<Record<string, number>> {
  const rules = await Rule.find().select("ruleId version").lean();
  const snapshot: Record<string, number> = {};
  for (const r of rules) snapshot[r.ruleId] = r.version;
  return snapshot;
}

/**
 * Runs the "Future updates" enhancement-point detectors (lib/audit/
 * detectEnhancements.ts) against this run's parsed theme source, restricted
 * to whatever points currently exist in the EnhancementPoint collection.
 * Deliberately independent of the rule engine and never allowed to fail the
 * audit: if the EnhancementPoint collection isn't seeded yet (or the lookup
 * throws for any reason), the run still completes — it just has no
 * enhancementDetections, same as a run from before this feature existed.
 */
async function detectEnhancementsForRun(files: ParsedFile[]): Promise<EnhancementDetectionResult[]> {
  try {
    const pointIds = await EnhancementPoint.find().distinct("pointId");
    if (pointIds.length === 0) return [];
    return detectEnhancementPoints(files, pointIds);
  } catch {
    return [];
  }
}

/**
 * Fetches the theme's finding history needed to classify this new run's
 * findings (phase-6 §10-13): the immediately preceding complete run's
 * findings (for status carry-forward + "persistent"), and every signature
 * ever seen across all of the theme's prior complete runs (for detecting
 * "reintroduced"). A theme with no prior complete run returns empty
 * arrays, so every finding classifies as first_seen with nothing to carry.
 */
async function loadThemeFindingHistory(
  themeId: unknown,
  currentAuditRunId: unknown
): Promise<{ mostRecentPriorFindings: CarriedFinding[]; allPriorFindings: DiffableFinding[] }> {
  const priorRuns = await AuditRun.find({ themeId, status: "complete", _id: { $ne: currentAuditRunId } })
    .sort({ startedAt: -1 })
    .select("_id")
    .lean();
  if (priorRuns.length === 0) return { mostRecentPriorFindings: [], allPriorFindings: [] };

  const [mostRecentPriorFindings, allPriorFindings] = await Promise.all([
    Finding.find({ auditRunId: priorRuns[0]._id }).select("ruleId category filePath severity finding status ignoredReason").lean(),
    Finding.find({ auditRunId: { $in: priorRuns.map((r) => r._id) } }).select("ruleId category filePath severity finding").lean(),
  ]);
  return { mostRecentPriorFindings, allPriorFindings };
}

// Captured once at persist time, from the same parsed source the finding
// came from — the original ZIP isn't kept by the static parser (it's
// extracted to a temp dir and discarded), so this is the only chance to
// preserve source context for later (phase-5 §8's "code context" panel).
// A live finding's filePath is a page URL, not a theme file, so this is
// null for those (the "static" layer's own domain, not live-check's).
function extractSourceSnippet(files: ParsedFile[], filePath: string, lineNumber: number | undefined | null): string | null {
  if (!lineNumber) return null;
  const file = files.find((f) => f.path === filePath);
  if (!file) return null;
  const lines = file.rawText.split("\n");
  const start = Math.max(0, lineNumber - 1 - SNIPPET_CONTEXT_LINES);
  const end = Math.min(lines.length, lineNumber + SNIPPET_CONTEXT_LINES);
  return lines
    .slice(start, end)
    .map((line, i) => `${start + i + 1}${start + i + 1 === lineNumber ? " >" : "  "} ${line}`)
    .join("\n");
}

function toFindingDocs(
  findings: ExecutedFinding[],
  auditRunId: unknown,
  layer: "static" | "live",
  files: ParsedFile[],
  history: HistoryClassification[]
) {
  return findings.map((f, i) => ({
    auditRunId,
    ruleId: f.ruleId,
    requirementId: f.requirementId ?? null,
    filePath: f.filePath,
    lineNumber: f.lineNumber ?? null,
    category: f.category,
    severity: f.severity,
    layer,
    presetLabel: f.presetLabel ?? null,
    finding: f.finding,
    recommendation: f.recommendation ?? null,
    sourceReference: f.sourceReference ?? null,
    sourceUrl: f.sourceUrl ?? null,
    sourceSnippet: layer === "static" ? extractSourceSnippet(files, f.filePath, f.lineNumber) : null,
    historicalState: history[i].historicalState,
    status: history[i].carriedStatus ?? "open",
    ignoredReason: history[i].carriedIgnoredReason,
  }));
}

export type ExecuteAuditRunParams = {
  theme: { _id: unknown };
  buffer: Buffer;
  demoStorePresets?: PresetLink[];
  // Set by the Themes module (app/api/themes/...) so the resulting AuditRun
  // is traceable back to the exact version/zip it ran against. Left
  // undefined by the original /api/audit/run route, which has neither.
  themeVersionId?: Types.ObjectId | string | null;
  themeZipId?: Types.ObjectId | string | null;
};

export type ExecuteAuditRunResult =
  | { ok: true; auditRun: AuditRunDoc & { _id: unknown }; findings: (ExecutedFinding & { layer: "static" | "live" })[] }
  | { ok: false; auditRun: AuditRunDoc & { _id: unknown }; error: string };

export type ExecuteAuditRunHooks = {
  // Fires once the pending AuditRun row exists (right after AuditRun.create,
  // before any of the actual slow work) — lets a caller respond to its own
  // client immediately with the run's id and let this function keep running
  // in the background, rather than blocking the HTTP response on the full
  // audit (see app/api/themes/.../audit/route.ts). The original
  // /api/audit/run route doesn't pass this and keeps its existing
  // fully-synchronous behavior unchanged.
  onStarted?: (auditRun: AuditRunDoc & { _id: unknown }) => void;
};

/**
 * The full audit-engine orchestration (extracted from app/api/audit/run/route.ts
 * verbatim, parameterized): parse the zip, run static rules, detect
 * enhancement points, optionally run live checks/page-speed, classify
 * finding history, persist Finding docs, finalize the AuditRun. Shared by
 * the original /api/audit/run route and every Themes-module route that
 * triggers an audit — neither duplicates this logic, and neither touches
 * lib/rules/, runRules, lib/audit/liveChecks/, or pageSpeed.ts directly. Never
 * throws — a failure marks the AuditRun "failed" and returns { ok: false },
 * matching the original route's catch-all behavior.
 */
export async function executeAuditRun(params: ExecuteAuditRunParams, hooks?: ExecuteAuditRunHooks): Promise<ExecuteAuditRunResult> {
  const { theme, buffer, demoStorePresets = [], themeVersionId = null, themeZipId = null } = params;

  const auditRun = await AuditRun.create({
    themeId: theme._id,
    themeVersionId,
    themeZipId,
    status: "running",
    startedAt: new Date(),
  });
  hooks?.onStarted?.(auditRun);

  const timer = new Stopwatch();
  try {
    await setStage(auditRun._id, "extracting");
    const result = await parseThemeZip(buffer);
    timer.record("extraction", result.timing.extraction);
    timer.record("validation", result.timing.validation);
    timer.record("parsing", result.timing.parsing);

    await setStage(auditRun._id, "running_rules");
    const { findings: staticFindings, summary: staticSummary, ruleErrors, timing: rulesTiming } =
      await runAuditRules(result.files);
    timer.record("themeIndex", rulesTiming.themeIndex);
    timer.record("ruleExecution", rulesTiming.ruleExecution);

    await setStage(auditRun._id, "detecting_features");
    const enhancementDetectionStart = Date.now();
    const enhancementDetections = await detectEnhancementsForRun(result.files);
    timer.record("enhancementDetection", Date.now() - enhancementDetectionStart);

    let liveFindings: ExecutedFinding[] = [];
    let liveCheckErrors: { label: string; url: string; error: string }[] = [];
    let pageSpeedMetrics: PageSpeedMetric[] = [];
    if (demoStorePresets.length > 0) {
      // One progress unit per preset per phase (live-check, page-speed) —
      // a rough but honest measure of "how much of the longest stage is
      // done", surfaced to a polling client via stageProgress.
      const totalUnits = demoStorePresets.length * 2;
      let completedUnits = 0;
      await setStage(auditRun._id, "checking_live", { completed: 0, total: totalUnits });
      const bumpProgress = () => {
        completedUnits += 1;
        void setStage(auditRun._id, "checking_live", { completed: completedUnits, total: totalUnits });
      };

      // Run concurrently: both phases are now plain fetch() calls (page-fact
      // extraction, and calls to Google's PageSpeed Insights API) with no
      // local browser involved, so there's no shared memory-budget reason
      // to serialize them the way the old Chromium-based checks required —
      // that constraint drove real OOM kills on a 512MB deployment when
      // this was last tried with two live Chromium instances; neither phase
      // launches one anymore.
      const liveCheckStart = Date.now();
      const pageSpeedStart = Date.now();
      const [liveResult, pageSpeedResult] = await Promise.all([
        runLiveChecksForPresets(demoStorePresets, bumpProgress),
        runPageSpeedChecksForPresets(demoStorePresets, bumpProgress),
      ]);
      timer.record("liveChecks", Date.now() - liveCheckStart);
      timer.record("pageSpeedChecks", Date.now() - pageSpeedStart);

      liveFindings = [...liveResult.findings, ...pageSpeedResult.findings];
      liveCheckErrors = [...liveResult.errors, ...pageSpeedResult.errors];
      pageSpeedMetrics = pageSpeedResult.metrics;
    }

    const { mostRecentPriorFindings, allPriorFindings } = await loadThemeFindingHistory(theme._id, auditRun._id);
    const allNewFindings = [...staticFindings, ...liveFindings];
    const history = classifyFindingHistory(mostRecentPriorFindings, allPriorFindings, allNewFindings);
    const staticHistory = history.slice(0, staticFindings.length);
    const liveHistory = history.slice(staticFindings.length);

    await setStage(auditRun._id, "persisting");
    const persistStart = Date.now();
    const findingDocs = [
      ...toFindingDocs(staticFindings, auditRun._id, "static", result.files, staticHistory),
      ...toFindingDocs(liveFindings, auditRun._id, "live", result.files, liveHistory),
    ];
    if (findingDocs.length > 0) await Finding.insertMany(findingDocs);
    timer.record("findingPersistence", Date.now() - persistStart);

    auditRun.status = "complete";
    auditRun.completedAt = new Date();
    // Plain assignment back to null/undefined isn't reliably picked up by
    // Mongoose's dirty-tracking here (it compares against the in-memory
    // doc's own last-known value, which was never updated by the setStage()
    // calls above — those go straight to the DB via updateOne, bypassing
    // this document entirely) — markModified forces both onto this save
    // regardless, so a stale mid-run stage/progress doesn't linger after
    // status flips to "complete".
    auditRun.currentStage = null;
    auditRun.markModified("currentStage");
    auditRun.stageProgress = undefined;
    auditRun.markModified("stageProgress");
    auditRun.fileStats = result.fileStats;
    auditRun.skippedFileCount = result.skippedFileCount;
    if (result.fileErrors.length > 0) auditRun.fileErrors = result.fileErrors;
    auditRun.summary = demoStorePresets.length > 0 ? summarizeFindings([...staticFindings, ...liveFindings]) : staticSummary;
    if (ruleErrors.length > 0) auditRun.ruleErrors = ruleErrors;
    auditRun.diagnostics = computeAuditDiagnostics(result.files, {
      filesSkipped: result.skippedFileCount,
      rulesSkippedDueToError: ruleErrors.length,
    });
    if (demoStorePresets.length > 0) auditRun.demoStorePresets = demoStorePresets;
    if (liveCheckErrors.length > 0) auditRun.liveCheckErrors = liveCheckErrors;
    if (pageSpeedMetrics.length > 0) auditRun.pageSpeed = pageSpeedMetrics;
    if (enhancementDetections.length > 0) auditRun.enhancementDetections = enhancementDetections;
    auditRun.ruleVersionSnapshot = await captureRuleVersionSnapshot();
    auditRun.parserVersion = PARSER_VERSION;
    auditRun.applicationVersion = APPLICATION_VERSION;
    auditRun.ruleEngineVersion = RULE_ENGINE_VERSION;
    auditRun.requirementsVersion = REQUIREMENTS_VERSION;
    auditRun.timingMs = timer.toRecord();
    await auditRun.save();

    const findings = [
      ...staticFindings.map((f) => ({ ...f, layer: "static" as const })),
      ...liveFindings.map((f) => ({ ...f, layer: "live" as const })),
    ];
    return { ok: true, auditRun, findings };
  } catch (err) {
    const message =
      err instanceof ThemeZipError || err instanceof InvalidThemeError
        ? err.message
        : `Unexpected error while parsing the theme: ${err instanceof Error ? err.message : String(err)}`;

    auditRun.status = "failed";
    auditRun.completedAt = new Date();
    auditRun.currentStage = null;
    auditRun.markModified("currentStage");
    auditRun.stageProgress = undefined;
    auditRun.markModified("stageProgress");
    auditRun.error = message;
    auditRun.timingMs = timer.toRecord();
    await auditRun.save();

    return { ok: false, auditRun, error: message };
  }
}
