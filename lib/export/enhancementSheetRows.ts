import { ENHANCEMENT_CATEGORIES } from "@/models/enhancement-point";
import type { SheetTab } from "./sheetRows";

// Deliberately its own column set — reusing the audit-checklist's
// TAB_COLUMNS (Severity/Rule ID/Recommendation/Page/...) would leave most
// columns blank, since enhancement points aren't findings against a
// specific audit run. One tab per category (same "the tab is the
// category, don't repeat it as a column" convention as sheetRows.ts's
// buildChecklistSheetTabs), mixing theme-store-trend and native-capability
// points within a category — a merchant working through "what should we
// add" naturally wants both kinds of evidence for the same feature area
// together, not split by how the point happened to be discovered.
export const ENHANCEMENT_TAB_COLUMNS = [
  "Point ID",
  "Name",
  "Source",
  "Adoption %",
  "Themes",
  "Tier",
  "Replaces (app category)",
  "Completeness",
  "Status",
  "Description",
  "What to check",
  "Source URL",
  "Notes",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  "theme-store-trend": "Theme Store trend",
  "native-capability": "Native capability",
};

const TIER_LABELS: Record<string, string> = {
  established: "Established",
  common: "Common",
  emerging: "Emerging",
  experimental: "Experimental",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  planned: "Planned",
  implemented: "Implemented",
  dismissed: "Not applicable",
};

export type SheetEnhancementPoint = {
  pointId: string;
  name: string;
  category: string;
  source: string;
  adoptionTier?: string | null;
  adoptionPercentage?: number | null;
  themeCount?: number | null;
  themeTotal?: number | null;
  appCategoryReplaced?: string | null;
  nativeCapabilityCompleteness?: string | null;
  status: string;
  description: string;
  auditHint?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
};

function buildRow(p: SheetEnhancementPoint): string[] {
  return [
    p.pointId,
    p.name,
    SOURCE_LABELS[p.source] ?? p.source,
    p.adoptionPercentage != null ? `${p.adoptionPercentage}%` : "",
    p.themeCount != null && p.themeTotal != null ? `${p.themeCount}/${p.themeTotal}` : "",
    p.adoptionTier ? (TIER_LABELS[p.adoptionTier] ?? p.adoptionTier) : "",
    p.appCategoryReplaced ?? "",
    p.nativeCapabilityCompleteness ?? "",
    STATUS_LABELS[p.status] ?? p.status,
    p.description,
    p.auditHint ?? "",
    p.sourceUrl ?? "",
    p.notes ?? "",
  ];
}

/**
 * One tab per category (ordered by ENHANCEMENT_CATEGORIES' canonical
 * order, empty categories omitted), one row per enhancement point — the
 * "Future updates" backlog's persistent Google Sheets checklist (see
 * app/api/enhancements/export/google-sheet/route.ts). Unlike the audit
 * checklist, there's no diff/merge step: a point's `status` already lives
 * in the database and is the single source of truth, so every export is a
 * plain full rewrite of current state rather than reconciling against
 * what the sheet said last time.
 */
export function buildEnhancementSheetTabs(points: SheetEnhancementPoint[]): SheetTab[] {
  const byCategory = new Map<string, SheetEnhancementPoint[]>();
  for (const p of points) {
    const list = byCategory.get(p.category);
    if (list) list.push(p);
    else byCategory.set(p.category, [p]);
  }

  const tabs: SheetTab[] = [];
  for (const category of ENHANCEMENT_CATEGORIES) {
    const categoryPoints = byCategory.get(category);
    if (!categoryPoints || categoryPoints.length === 0) continue;
    // Most-adopted first within a tab, native (no %) points last.
    const sorted = categoryPoints
      .slice()
      .sort((a, b) => (b.themeCount ?? -1) - (a.themeCount ?? -1) || a.name.localeCompare(b.name));
    const rows: string[][] = [[...ENHANCEMENT_TAB_COLUMNS], ...sorted.map(buildRow)];
    tabs.push({ title: category, rows });
  }
  return tabs;
}

// A "Category" column instead of one tab per category — unlike the
// standalone backlog export (69 points across 11 tabs is fine on its own
// spreadsheet), this tab sits alongside a theme's 6 audit-checklist tabs,
// and adding 11 more per export would make an already-multi-tab workbook
// unwieldy. Mirrors the on-screen per-theme report tab's framing (one
// consolidated view, not one per category) rather than the global page's.
export const FUTURE_UPDATES_TAB_COLUMNS = [
  "Point ID",
  "Name",
  "Category",
  "Source",
  "Adoption %",
  "Themes",
  "Tier",
  "Replaces (app category)",
  "Completeness",
  "Detected",
  "Detected In",
  "Status",
  "Description",
  "What to check",
  "Source URL",
] as const;

const DETECTED_LABELS: Record<string, string> = {
  true: "Yes",
  false: "No",
  null: "Not checked",
};

export type SheetFutureUpdatesPoint = SheetEnhancementPoint & {
  /** true/false once detection ran for this specific audit run; null if it hasn't (see enhancementDetectionAvailable). */
  detected: boolean | null;
  matches: { filePath: string; lineNumber: number | null }[];
};

function buildFutureUpdatesRow(p: SheetFutureUpdatesPoint): string[] {
  const detectedIn = p.matches.map((m) => (m.lineNumber ? `${m.filePath}:${m.lineNumber}` : m.filePath)).join("; ");
  return [
    p.pointId,
    p.name,
    p.category,
    SOURCE_LABELS[p.source] ?? p.source,
    p.adoptionPercentage != null ? `${p.adoptionPercentage}%` : "",
    p.themeCount != null && p.themeTotal != null ? `${p.themeCount}/${p.themeTotal}` : "",
    p.adoptionTier ? (TIER_LABELS[p.adoptionTier] ?? p.adoptionTier) : "",
    p.appCategoryReplaced ?? "",
    p.nativeCapabilityCompleteness ?? "",
    DETECTED_LABELS[String(p.detected)],
    detectedIn,
    STATUS_LABELS[p.status] ?? p.status,
    p.description,
    p.auditHint ?? "",
    p.sourceUrl ?? "",
  ];
}

/**
 * A single "Future Updates" tab reporting which of the backlog's points
 * THIS theme's audited source already has — the sheet counterpart of the
 * on-screen per-theme report tab (app/_components/enhancementReport.tsx),
 * built from the same joined data (lib/audit/enhancementReport.ts). Folded
 * into a theme's existing audit-checklist spreadsheet
 * (app/api/reports/[id]/export/google-sheet/route.ts) as one more tab
 * rather than a separate spreadsheet, since a merchant reviewing a
 * theme's audit checklist is exactly who wants to see what that same
 * theme is missing right next to it.
 */
export function buildFutureUpdatesTab(points: SheetFutureUpdatesPoint[]): SheetTab {
  const sorted = points
    .slice()
    .sort((a, b) => (b.themeCount ?? -1) - (a.themeCount ?? -1) || a.name.localeCompare(b.name));
  const rows: string[][] = [[...FUTURE_UPDATES_TAB_COLUMNS], ...sorted.map(buildFutureUpdatesRow)];
  return { title: "Future Updates", rows };
}
