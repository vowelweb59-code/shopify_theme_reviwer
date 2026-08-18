import { FINDING_CATEGORIES } from "@/models/finding";
import { getPageLabel } from "@/lib/audit/pageLabel";
import { exactSignature, type DiffableFinding } from "@/lib/audit/findingSignature";
import type { DiffFinding, DiffStatus } from "@/lib/audit/diffFindings";

export type SheetChecklistFinding = DiffableFinding & {
  requirementId?: string | null;
  lineNumber?: number | null;
  recommendation?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
};

export type SheetTab = { title: string; rows: string[][] };

// No "Category" column here — the tab itself is the category, so
// repeating it on every row would be redundant. Exported so
// lib/google/sheetsFormatting.ts and lib/google/sheetsExport.ts can look
// up column indices/letters by name instead of duplicating this order as
// magic numbers.
export const TAB_COLUMNS = [
  "Audit ID",
  "Theme",
  "Severity",
  "Status",
  "Resolved",
  "Rule ID",
  "Requirement ID",
  "Finding",
  "Recommendation",
  "Page",
  "File",
  "Line",
  "Source",
] as const;

const STATUS_LABELS: Record<DiffStatus, string> = {
  resolved: "Resolved",
  still_present: "Still Open",
  new: "New",
  changed: "Changed",
};

const SEVERITY_COLUMN_INDEX = TAB_COLUMNS.indexOf("Severity");
const RESOLVED_COLUMN_INDEX = TAB_COLUMNS.indexOf("Resolved");
const RULE_ID_COLUMN_INDEX = TAB_COLUMNS.indexOf("Rule ID");
const FINDING_COLUMN_INDEX = TAB_COLUMNS.indexOf("Finding");
const FILE_COLUMN_INDEX = TAB_COLUMNS.indexOf("File");

function buildChecklistRow(auditRunId: string, themeName: string, f: DiffFinding<SheetChecklistFinding>): string[] {
  const shown = (f.current ?? f.previous)!;
  const source = shown.sourceUrl ?? shown.sourceReference ?? "";
  return [
    auditRunId,
    themeName,
    shown.severity,
    STATUS_LABELS[f.status],
    f.status === "resolved" ? "TRUE" : "FALSE",
    shown.ruleId,
    shown.requirementId ?? "",
    shown.finding,
    shown.recommendation ?? "",
    getPageLabel(shown.filePath) ?? "",
    shown.filePath,
    shown.lineNumber != null ? String(shown.lineNumber) : "",
    source,
  ];
}

/**
 * One tab per category, one row per diff entry between a theme's baseline
 * (immediately preceding complete run) and current audit run — the
 * theme's persistent Google Sheets checklist (see
 * app/api/reports/[id]/export/google-sheet/route.ts). Unlike a flat
 * single-run export, a finding that's been fixed still gets a row here
 * (status "resolved", Resolved column "TRUE") rather than disappearing,
 * so re-exporting after every re-audit reads as a checklist across the
 * theme's whole history, not just the latest run. Categories with no
 * findings in this diff are omitted rather than added as empty tabs;
 * ordered by FINDING_CATEGORIES' canonical order, not first-seen order.
 */
export function buildChecklistSheetTabs(
  auditRunId: string,
  themeName: string,
  diffFindings: DiffFinding<SheetChecklistFinding>[]
): SheetTab[] {
  const byCategory = new Map<string, DiffFinding<SheetChecklistFinding>[]>();
  for (const f of diffFindings) {
    const category = (f.current ?? f.previous)!.category;
    const list = byCategory.get(category);
    if (list) list.push(f);
    else byCategory.set(category, [f]);
  }

  const tabs: SheetTab[] = [];
  for (const category of FINDING_CATEGORIES) {
    const categoryFindings = byCategory.get(category);
    if (!categoryFindings || categoryFindings.length === 0) continue;
    const rows: string[][] = [[...TAB_COLUMNS], ...categoryFindings.map((f) => buildChecklistRow(auditRunId, themeName, f))];
    tabs.push({ title: category, rows });
  }
  return tabs;
}

export type ParsedChecklistRow = { signature: string; isResolved: boolean };

/**
 * Reconstructs a previously-written sheet row's stable finding identity
 * (the same signature the diff engine uses) and resolved state, so
 * lib/export/checklistMerge.ts can tell whether a row already on the sheet
 * is still represented in this export's fresh diff or needs carrying
 * forward untouched. `category` comes from the tab title, since the sheet
 * doesn't repeat it as its own column.
 */
export function parseChecklistRow(row: string[], category: string): ParsedChecklistRow {
  const signature = exactSignature({
    ruleId: row[RULE_ID_COLUMN_INDEX] ?? "",
    category,
    filePath: row[FILE_COLUMN_INDEX] ?? "",
    severity: (row[SEVERITY_COLUMN_INDEX] ?? "low") as DiffableFinding["severity"],
    finding: row[FINDING_COLUMN_INDEX] ?? "",
  });
  return { signature, isResolved: row[RESOLVED_COLUMN_INDEX] === "TRUE" };
}
