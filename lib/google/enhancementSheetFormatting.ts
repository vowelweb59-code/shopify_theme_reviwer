import { ENHANCEMENT_TAB_COLUMNS } from "@/lib/export/enhancementSheetRows";
import type { SheetFormattingRequest } from "./sheetsFormatting";

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
  Source: 130,
  "Adoption %": 90,
  Themes: 90,
  Tier: 100,
  "Replaces (app category)": 220,
  Completeness: 100,
  Status: 110,
  Description: 380,
  "What to check": 320,
  "Source URL": 260,
  Notes: 220,
};

const WRAP_COLUMNS = ["Description", "What to check", "Notes"] as const;
const TIER_COLUMN_INDEX = ENHANCEMENT_TAB_COLUMNS.indexOf("Tier");
const STATUS_COLUMN_INDEX = ENHANCEMENT_TAB_COLUMNS.indexOf("Status");

/**
 * The enhancement-sheet counterpart to lib/google/sheetsFormatting.ts's
 * buildSheetFormattingRequests — same visual treatment (frozen/styled
 * header, column widths, wrapped long-text columns, tier/status
 * color-coding, zebra striping, per-category tab color), but built against
 * ENHANCEMENT_TAB_COLUMNS instead of the audit checklist's TAB_COLUMNS.
 * Kept as a separate function rather than parameterizing the audit one
 * further — the two column schemas share no columns in common by name or
 * position, so trying to unify them would just move the audit-specific
 * assumptions into more parameters instead of removing them.
 */
export function buildEnhancementSheetFormattingRequests(
  sheetId: number,
  dataRowCount: number,
  category: string
): SheetFormattingRequest[] {
  const endRowIndex = dataRowCount + 1;

  return [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 }, tabColor: tabColorFor(category) },
        fields: "gridProperties.frozenRowCount,tabColor",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: ENHANCEMENT_TAB_COLUMNS.length },
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
    ...ENHANCEMENT_TAB_COLUMNS.map((column, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: COLUMN_WIDTHS[column] ?? 150 },
        fields: "pixelSize",
      },
    })),
    ...WRAP_COLUMNS.map((column) => {
      const columnIndex = ENHANCEMENT_TAB_COLUMNS.indexOf(column);
      return {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      };
    }),
    ...Object.entries(TIER_COLORS).map(([tier, colors]) => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: TIER_COLUMN_INDEX, endColumnIndex: TIER_COLUMN_INDEX + 1 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: tier }] },
            format: { backgroundColor: colors.background, textFormat: { foregroundColor: colors.text, bold: true } },
          },
        },
        index: 0,
      },
    })),
    ...Object.entries(STATUS_COLORS).map(([status, colors]) => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: STATUS_COLUMN_INDEX, endColumnIndex: STATUS_COLUMN_INDEX + 1 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: status }] },
            format: { backgroundColor: colors.background, textFormat: { foregroundColor: colors.text, bold: true } },
          },
        },
        index: 0,
      },
    })),
    {
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 0, endColumnIndex: ENHANCEMENT_TAB_COLUMNS.length },
          rowProperties: {
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.97, green: 0.97, blue: 0.98 },
          },
        },
      },
    },
  ];
}
