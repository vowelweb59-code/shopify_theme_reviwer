import type { DiffFinding, DiffableFinding } from "@/lib/audit/diffFindings";
import { escapeCsvField } from "./csvUtil";

export type DiffCsvFinding = DiffableFinding & { requirementId?: string | null; lineNumber?: number | null; sourceUrl?: string | null };

const COLUMNS = [
  "Diff Status",
  "Severity",
  "Category",
  "Rule ID",
  "Requirement ID",
  "File",
  "Previous Line",
  "Current Line",
  "Previous Finding",
  "Current Finding",
  "Source",
] as const;

/** Comparison export per phase-6 §22 — the diff-specific counterpart to the single-audit CSV export in lib/export/csv.ts. */
export function buildDiffCsv(findings: DiffFinding<DiffCsvFinding>[]): string {
  const rows = [COLUMNS.join(",")];
  for (const f of findings) {
    const shown = f.current ?? f.previous!;
    const fields = [
      f.status,
      shown.severity,
      shown.category,
      shown.ruleId,
      shown.requirementId ?? "",
      shown.filePath,
      f.previous?.lineNumber != null ? String(f.previous.lineNumber) : "",
      f.current?.lineNumber != null ? String(f.current.lineNumber) : "",
      f.previous?.finding ?? "",
      f.current?.finding ?? "",
      shown.sourceUrl ?? "",
    ];
    rows.push(fields.map((v) => escapeCsvField(String(v))).join(","));
  }
  return rows.join("\r\n");
}
