export type CsvFindingRow = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: string;
  layer?: string | null;
  finding: string;
  recommendation?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
};

const COLUMNS = [
  "Audit ID",
  "Theme",
  "Severity",
  "Category",
  "Rule ID",
  "Requirement ID",
  "Finding",
  "Recommendation",
  "File",
  "Line",
  "Source",
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Flat CSV export per phase-5 §13 — only fields the data model actually has; no fabricated Confidence/Status columns. */
export function buildFindingsCsv(auditRunId: string, themeName: string, findings: CsvFindingRow[]): string {
  const rows = [COLUMNS.join(",")];
  for (const f of findings) {
    const source = f.sourceUrl ?? f.sourceReference ?? "";
    const fields = [
      auditRunId,
      themeName,
      f.severity,
      f.category,
      f.ruleId,
      f.requirementId ?? "",
      f.finding,
      f.recommendation ?? "",
      f.filePath,
      f.lineNumber != null ? String(f.lineNumber) : "",
      source,
    ];
    rows.push(fields.map((v) => escapeCsvField(String(v))).join(","));
  }
  return rows.join("\r\n");
}
