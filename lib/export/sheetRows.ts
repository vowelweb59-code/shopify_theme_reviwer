import { FINDING_CATEGORIES } from "@/models/finding";

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

export type SheetTab = { title: string; rows: string[][] };

// No "Category" column here — the tab itself is the category, so
// repeating it on every row would be redundant.
const TAB_COLUMNS = [
  "Audit ID",
  "Theme",
  "Severity",
  "Rule ID",
  "Requirement ID",
  "Finding",
  "Recommendation",
  "File",
  "Line",
  "Source",
] as const;

function buildRow(auditRunId: string, themeName: string, f: SheetFindingRow): string[] {
  const source = f.sourceUrl ?? f.sourceReference ?? "";
  return [
    auditRunId,
    themeName,
    f.severity,
    f.ruleId,
    f.requirementId ?? "",
    f.finding,
    f.recommendation ?? "",
    f.filePath,
    f.lineNumber != null ? String(f.lineNumber) : "",
    source,
  ];
}

/**
 * One tab per category — Theme Store Compliance, Accessibility, Technical
 * SEO, etc. (the app's existing FINDING_CATEGORIES, same ones used by the
 * category dashboard and filters everywhere else). Categories with no
 * findings in this run are omitted rather than added as empty tabs.
 * Ordered by FINDING_CATEGORIES' canonical order, not first-seen order.
 */
export function buildCategorySheetTabs(auditRunId: string, themeName: string, findings: SheetFindingRow[]): SheetTab[] {
  const byCategory = new Map<string, SheetFindingRow[]>();
  for (const f of findings) {
    const list = byCategory.get(f.category);
    if (list) list.push(f);
    else byCategory.set(f.category, [f]);
  }

  const tabs: SheetTab[] = [];
  for (const category of FINDING_CATEGORIES) {
    const categoryFindings = byCategory.get(category);
    if (!categoryFindings || categoryFindings.length === 0) continue;
    const rows: string[][] = [[...TAB_COLUMNS], ...categoryFindings.map((f) => buildRow(auditRunId, themeName, f))];
    tabs.push({ title: category, rows });
  }
  return tabs;
}
