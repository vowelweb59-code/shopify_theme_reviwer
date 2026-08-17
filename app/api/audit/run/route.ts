import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { parseThemeZip, ThemeZipError, InvalidThemeError, type ParsedFile } from "@/lib/theme-parser";
import { runAuditRules } from "@/lib/audit";
import { computeAuditDiagnostics } from "@/lib/audit/diagnostics";
import { summarizeFindings, type ExecutedFinding } from "@/lib/audit/runRules";
import { runLiveChecks } from "@/lib/audit/liveCheck";

const SNIPPET_CONTEXT_LINES = 3;

// Captured once at persist time, from the same parsed source the finding
// came from — the original ZIP isn't kept, so this is the only chance to
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

function toFindingDocs(findings: ExecutedFinding[], auditRunId: unknown, layer: "static" | "live", files: ParsedFile[]) {
  return findings.map((f) => ({
    auditRunId,
    ruleId: f.ruleId,
    requirementId: f.requirementId ?? null,
    filePath: f.filePath,
    lineNumber: f.lineNumber ?? null,
    category: f.category,
    severity: f.severity,
    layer,
    finding: f.finding,
    recommendation: f.recommendation ?? null,
    sourceReference: f.sourceReference ?? null,
    sourceUrl: f.sourceUrl ?? null,
    sourceSnippet: layer === "static" ? extractSourceSnippet(files, f.filePath, f.lineNumber) : null,
  }));
}

export async function POST(request: Request) {
  await connectToDatabase();

  const formData = await request.formData();
  const themeName = formData.get("themeName")?.toString().trim();
  const file = formData.get("file");
  const demoStoreUrlRaw = formData.get("demoStoreUrl")?.toString().trim();
  // Only http(s) — never file://, javascript:, etc. — this is fetched
  // server-side via a real browser, not just linked.
  const demoStoreUrl = demoStoreUrlRaw && /^https?:\/\//i.test(demoStoreUrlRaw) ? demoStoreUrlRaw : undefined;

  if (!themeName) {
    return NextResponse.json({ error: "themeName is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A theme ZIP file is required." }, { status: 400 });
  }

  const theme =
    (await Theme.findOne({ name: themeName })) ?? (await Theme.create({ name: themeName }));
  if (theme.sourceFileName !== file.name) {
    theme.sourceFileName = file.name;
    await theme.save();
  }

  const auditRun = await AuditRun.create({
    themeId: theme._id,
    status: "running",
    startedAt: new Date(),
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseThemeZip(buffer);
    const { findings: staticFindings, summary: staticSummary, ruleErrors } = await runAuditRules(result.files);

    let liveFindings: ExecutedFinding[] = [];
    let liveCheckError: { url: string; error: string } | undefined;
    if (demoStoreUrl) {
      const liveResult = await runLiveChecks(demoStoreUrl);
      liveFindings = liveResult.findings;
      liveCheckError = liveResult.error;
    }

    const findingDocs = [
      ...toFindingDocs(staticFindings, auditRun._id, "static", result.files),
      ...toFindingDocs(liveFindings, auditRun._id, "live", result.files),
    ];
    if (findingDocs.length > 0) await Finding.insertMany(findingDocs);

    auditRun.status = "complete";
    auditRun.completedAt = new Date();
    auditRun.fileStats = result.fileStats;
    auditRun.skippedFileCount = result.skippedFileCount;
    if (result.fileErrors.length > 0) auditRun.fileErrors = result.fileErrors;
    auditRun.summary = demoStoreUrl ? summarizeFindings([...staticFindings, ...liveFindings]) : staticSummary;
    if (ruleErrors.length > 0) auditRun.ruleErrors = ruleErrors;
    auditRun.diagnostics = computeAuditDiagnostics(result.files, {
      filesSkipped: result.skippedFileCount,
      rulesSkippedDueToError: ruleErrors.length,
    });
    if (demoStoreUrl) auditRun.demoStoreUrl = demoStoreUrl;
    if (liveCheckError) auditRun.liveCheckError = liveCheckError;
    await auditRun.save();

    const findings = [
      ...staticFindings.map((f) => ({ ...f, layer: "static" as const })),
      ...liveFindings.map((f) => ({ ...f, layer: "live" as const })),
    ];
    return NextResponse.json({ theme, auditRun, findings }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof ThemeZipError || err instanceof InvalidThemeError
        ? err.message
        : `Unexpected error while parsing the theme: ${err instanceof Error ? err.message : String(err)}`;

    auditRun.status = "failed";
    auditRun.completedAt = new Date();
    auditRun.error = message;
    await auditRun.save();

    return NextResponse.json({ theme, auditRun, error: message }, { status: 400 });
  }
}
