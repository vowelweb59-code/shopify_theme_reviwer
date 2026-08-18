import { escapeCsvField } from "./csvUtil";
import { getPageLabel } from "@/lib/audit/pageLabel";

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
  "Page",
  "File",
  "Line",
  "Source",
] as const;

/** Flat CSV export per phase-5 §13 — only fields the data model actually has; no fabricated Confidence/Status columns. "Page" is derived from "File" (see lib/audit/pageLabel.ts), not a stored field. */
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
      getPageLabel(f.filePath) ?? "",
      f.filePath,
      f.lineNumber != null ? String(f.lineNumber) : "",
      source,
    ];
    rows.push(fields.map((v) => escapeCsvField(String(v))).join(","));
  }
  return rows.join("\r\n");
}
