import { ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS } from "@/lib/export/enhancementSheetRows";
import type { SheetFormattingRequest, SheetTab } from "@/lib/export/sheetRows";

type RGB = { red: number; green: number; blue: number };

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

const HEADER_BACKGROUND = hexToRgb("#1e293b");
const HEADER_TEXT = hexToRgb("#ffffff");

// Same visual language as the tier badges on /enhancements
// (app/enhancements/page.tsx's TIER_STYLES) — emerald/sky/amber/zinc.
const TIER_COLORS: Record<string, { background: RGB; text: RGB }> = {
  Established: { background: hexToRgb("#d1fae5"), text: hexToRgb("#065f46") },
  Common: { background: hexToRgb("#dbeafe"), text: hexToRgb("#1e40af") },
  Emerging: { background: hexToRgb("#fef3c7"), text: hexToRgb("#92400e") },
  Experimental: { background: hexToRgb("#f4f4f5"), text: hexToRgb("#3f3f46") },
};

// Mirrors the app's STATUS_LABELS badge treatment — implemented reads as
// done, planned/backlog stay neutral, dismissed fades out.
const STATUS_COLORS: Record<string, { background: RGB; text: RGB }> = {
  Implemented: { background: hexToRgb("#dcfce7"), text: hexToRgb("#166534") },
  Planned: { background: hexToRgb("#dbeafe"), text: hexToRgb("#1e40af") },
  Backlog: { background: hexToRgb("#f4f4f5"), text: hexToRgb("#3f3f46") },
  "Not applicable": { background: hexToRgb("#f4f4f5"), text: hexToRgb("#a1a1aa") },
};

// One color per category, cycled rather than hand-mapped — there are 11
// categories (models/enhancement-point.ts's ENHANCEMENT_CATEGORIES) and,
// unlike the audit checklist's severity colors, no existing app-side badge
// palette to mirror exactly, so this is purely a scannable tab-navigation aid.
const TAB_COLOR_PALETTE = [
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#14b8a6",
  "#f97316",
  "#ef4444",
  "#0ea5e9",
  "#eab308",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
].map(hexToRgb);

function tabColorFor(category: string): RGB {
  const categories = [
    "Content & Media",
    "Merchandising",
    "Theme Customization",
    "Product Discovery",
    "Cart & Checkout",
    "Platform Integration",
    "Internationalization",
    "Accessibility",
    "Performance",
    "SEO & AEO",
    "Trust & Compliance",
  ];
  const index = categories.indexOf(category);
  return TAB_COLOR_PALETTE[index >= 0 ? index % TAB_COLOR_PALETTE.length : 0];
}

const COLUMN_WIDTHS: Record<string, number> = {
  "Point ID": 130,
  Name: 260,
  Category: 160,
  Source: 130,
  "Adoption %": 90,
  Themes: 90,
  Tier: 100,
  "Replaces (app category)": 220,
  Completeness: 100,
  Detected: 100,
  "Detected In": 260,
  Status: 110,
  Description: 380,
  "What to check": 320,
  "Source URL": 260,
  Notes: 220,
};

const WRAP_COLUMNS = ["Description", "What to check", "Notes", "Detected In"] as const;

const DETECTED_COLORS: Record<string, { background: RGB; text: RGB }> = {
  Yes: { background: hexToRgb("#dcfce7"), text: hexToRgb("#166534") },
  No: { background: hexToRgb("#f4f4f5"), text: hexToRgb("#3f3f46") },
  "Not checked": { background: hexToRgb("#fef3c7"), text: hexToRgb("#92400e") },
};

/**
 * The shared body of both formatting builders below: frozen/styled header,
 * column widths, wrapped long-text columns, tier/status/detected
 * color-coding (whichever of those three columns actually exist in
 * `columns`), zebra striping, per-category tab color. Column-name lookups
 * throughout resolve against whichever `columns` list is passed in, so the
 * one-tab-per-category enhancement sheet and the single consolidated
 * per-theme "Future Updates" tab — genuinely different column orders and
 * counts — can share this instead of two near-identical copies.
 */
function buildFormattingForColumns(
  sheetId: number,
  dataRowCount: number,
  category: string,
  columns: readonly string[]
): SheetFormattingRequest[] {
  const endRowIndex = dataRowCount + 1;
  const tierColumnIndex = columns.indexOf("Tier");
  const statusColumnIndex = columns.indexOf("Status");
  const detectedColumnIndex = columns.indexOf("Detected");

  const colorRule = (columnIndex: number, value: string, colors: { background: RGB; text: RGB }) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 }],
        booleanRule: {
          condition: { type: "TEXT_EQ", values: [{ userEnteredValue: value }] },
          format: { backgroundColor: colors.background, textFormat: { foregroundColor: colors.text, bold: true } },
        },
      },
      index: 0,
    },
  });

  return [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 }, tabColor: tabColorFor(category) },
        fields: "gridProperties.frozenRowCount,tabColor",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BACKGROUND,
            textFormat: { foregroundColor: HEADER_TEXT, bold: true, fontSize: 10 },
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
      },
    },
    ...columns.map((column, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: COLUMN_WIDTHS[column] ?? 150 },
        fields: "pixelSize",
      },
    })),
    ...WRAP_COLUMNS.filter((column) => columns.includes(column)).map((column) => {
      const columnIndex = columns.indexOf(column);
      return {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      };
    }),
    ...(tierColumnIndex >= 0 ? Object.entries(TIER_COLORS).map(([tier, colors]) => colorRule(tierColumnIndex, tier, colors)) : []),
    ...(statusColumnIndex >= 0
      ? Object.entries(STATUS_COLORS).map(([status, colors]) => colorRule(statusColumnIndex, status, colors))
      : []),
    ...(detectedColumnIndex >= 0
      ? Object.entries(DETECTED_COLORS).map(([detected, colors]) => colorRule(detectedColumnIndex, detected, colors))
      : []),
    {
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 0, endColumnIndex: columns.length },
          rowProperties: {
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.97, green: 0.97, blue: 0.98 },
          },
        },
      },
    },
  ];
}

/**
 * The enhancement-sheet counterpart to lib/google/sheetsFormatting.ts's
 * buildSheetFormattingRequests, for the one-tab-per-category standalone
 * "Future updates" backlog export.
 */
export function buildEnhancementSheetFormattingRequests(
  sheetId: number,
  dataRowCount: number,
  category: string
): SheetFormattingRequest[] {
  return buildFormattingForColumns(sheetId, dataRowCount, category, ENHANCEMENT_TAB_COLUMNS);
}

/**
 * Formatting for the single consolidated "Future Updates" tab folded into
 * a theme's audit-checklist spreadsheet (see
 * lib/export/enhancementSheetRows.ts's buildFutureUpdatesTab). `category`
 * here is always the tab's own title ("Future Updates", not a real
 * category), so its tab color falls through tabColorFor's default rather
 * than being meaningful — this tab doesn't need a category-specific color
 * since there's only one of it per spreadsheet.
 */
export function buildFutureUpdatesFormattingRequests(sheetId: number, dataRowCount: number, category: string): SheetFormattingRequest[] {
  return buildFormattingForColumns(sheetId, dataRowCount, category, FUTURE_UPDATES_TAB_COLUMNS);
}

/**
 * Tags a batch of one-tab-per-category enhancement tabs (built by
 * lib/export/enhancementSheetRows.ts's buildEnhancementSheetTabs) with
 * this module's formatting and "no boolean column" — kept here rather
 * than inside that file to avoid a circular import (this file already
 * imports ENHANCEMENT_TAB_COLUMNS from it). Used by the standalone
 * "Future updates" backlog export.
 */
export function withEnhancementSheetFormatting(tabs: SheetTab[]): SheetTab[] {
  return tabs.map((tab) => ({ ...tab, booleanColumnIndex: -1, formatting: buildEnhancementSheetFormattingRequests }));
}

/**
 * Same idea as withEnhancementSheetFormatting, for the single consolidated
 * "Future Updates" tab (buildFutureUpdatesTab) folded into a theme's
 * audit-checklist spreadsheet.
 */
export function withFutureUpdatesFormatting(tab: SheetTab): SheetTab {
  return { ...tab, booleanColumnIndex: -1, formatting: buildFutureUpdatesFormattingRequests };
}
