import type { CoverageResult } from "@/lib/audit/coverage";
import type { ReadinessResult } from "@/lib/audit/readiness";

export type JsonExportFinding = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: string;
  layer?: string | null;
  status?: string | null;
  ignoredReason?: string | null;
  finding: string;
  recommendation?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  sourceSnippet?: string | null;
};

// Normalized machine-readable export per phase-5 §13/§15 — the same shape
// a script/CI job could consume without needing this app's DB or UI.
export function buildAuditReportJson(opts: {
  auditRunId: string;
  themeName: string;
  startedAt: string;
  completedAt: string | null;
  summary: { total: number; blocker: number; high: number; medium: number; low: number; byCategory?: Record<string, number> };
  coverage: CoverageResult;
  coverageByCategory: Record<string, CoverageResult>;
  readiness: ReadinessResult | null;
  findings: JsonExportFinding[];
  diagnostics?: { parserWarnings: number; unresolvedDynamicReferences: number; filesSkipped: number; rulesSkippedDueToError: number };
}) {
  return {
    auditRun: {
      id: opts.auditRunId,
      theme: opts.themeName,
      startedAt: opts.startedAt,
      completedAt: opts.completedAt,
    },
    summary: opts.summary,
    coverage: opts.coverage,
    coverageByCategory: opts.coverageByCategory,
    readiness: opts.readiness,
    diagnostics: opts.diagnostics ?? null,
    findings: opts.findings,
    generatedAt: new Date().toISOString(),
  };
}
