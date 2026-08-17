export type SheetFindingRow = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: string;
  finding: string;
  recommendation?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
};

// Same columns as lib/export/csv.ts's buildFindingsCsv, so the two exports
// read as the same report in different destinations.
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

export function buildFindingsSheetRows(auditRunId: string, themeName: string, findings: SheetFindingRow[]): string[][] {
  const rows: string[][] = [[...COLUMNS]];
  for (const f of findings) {
    const source = f.sourceUrl ?? f.sourceReference ?? "";
    rows.push([
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
    ]);
  }
  return rows;
}
