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
import { runLiveChecksForPresets, type PresetLink } from "@/lib/audit/liveCheck";
import { runPageSpeedChecksForPresets, type PageSpeedMetric } from "@/lib/audit/pageSpeed";
import { classifyFindingHistory, type CarriedFinding, type HistoryClassification } from "@/lib/audit/findingHistory";
import type { DiffableFinding } from "@/lib/audit/findingSignature";

const SNIPPET_CONTEXT_LINES = 3;

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

/**
 * The full audit-engine orchestration (extracted from app/api/audit/run/route.ts
 * verbatim, parameterized): parse the zip, run static rules, detect
 * enhancement points, optionally run live checks/page-speed, classify
 * finding history, persist Finding docs, finalize the AuditRun. Shared by
 * the original /api/audit/run route and every Themes-module route that
 * triggers an audit — neither duplicates this logic, and neither touches
 * lib/rules/, runRules, liveCheck.ts, or pageSpeed.ts directly. Never
 * throws — a failure marks the AuditRun "failed" and returns { ok: false },
 * matching the original route's catch-all behavior.
 */
export async function executeAuditRun(params: ExecuteAuditRunParams): Promise<ExecuteAuditRunResult> {
  const { theme, buffer, demoStorePresets = [], themeVersionId = null, themeZipId = null } = params;

  const auditRun = await AuditRun.create({
    themeId: theme._id,
    themeVersionId,
    themeZipId,
    status: "running",
    startedAt: new Date(),
  });

  const timer = new Stopwatch();
  try {
    const result = await parseThemeZip(buffer);
    timer.record("extraction", result.timing.extraction);
    timer.record("validation", result.timing.validation);
    timer.record("parsing", result.timing.parsing);

    const { findings: staticFindings, summary: staticSummary, ruleErrors, timing: rulesTiming } =
      await runAuditRules(result.files);
    timer.record("themeIndex", rulesTiming.themeIndex);
    timer.record("ruleExecution", rulesTiming.ruleExecution);

    const enhancementDetectionStart = Date.now();
    const enhancementDetections = await detectEnhancementsForRun(result.files);
    timer.record("enhancementDetection", Date.now() - enhancementDetectionStart);

    let liveFindings: ExecutedFinding[] = [];
    let liveCheckErrors: { label: string; url: string; error: string }[] = [];
    let pageSpeedMetrics: PageSpeedMetric[] = [];
    if (demoStorePresets.length > 0) {
      const liveCheckStart = Date.now();
      const liveResult = await runLiveChecksForPresets(demoStorePresets);
      liveFindings = liveResult.findings;
      liveCheckErrors = liveResult.errors;
      timer.record("liveChecks", Date.now() - liveCheckStart);

      const pageSpeedStart = Date.now();
      const pageSpeedResult = await runPageSpeedChecksForPresets(demoStorePresets);
      liveFindings = [...liveFindings, ...pageSpeedResult.findings];
      liveCheckErrors = [...liveCheckErrors, ...pageSpeedResult.errors];
      pageSpeedMetrics = pageSpeedResult.metrics;
      timer.record("pageSpeedChecks", Date.now() - pageSpeedStart);
    }

    const { mostRecentPriorFindings, allPriorFindings } = await loadThemeFindingHistory(theme._id, auditRun._id);
    const allNewFindings = [...staticFindings, ...liveFindings];
    const history = classifyFindingHistory(mostRecentPriorFindings, allPriorFindings, allNewFindings);
    const staticHistory = history.slice(0, staticFindings.length);
    const liveHistory = history.slice(staticFindings.length);

    const persistStart = Date.now();
    const findingDocs = [
      ...toFindingDocs(staticFindings, auditRun._id, "static", result.files, staticHistory),
      ...toFindingDocs(liveFindings, auditRun._id, "live", result.files, liveHistory),
    ];
    if (findingDocs.length > 0) await Finding.insertMany(findingDocs);
    timer.record("findingPersistence", Date.now() - persistStart);

    auditRun.status = "complete";
    auditRun.completedAt = new Date();
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
    auditRun.error = message;
    auditRun.timingMs = timer.toRecord();
    await auditRun.save();

    return { ok: false, auditRun, error: message };
  }
}
