import { TAB_COLUMNS } from "@/lib/export/sheetRows";

type RGB = { red: number; green: number; blue: number };

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

const HEADER_BACKGROUND = hexToRgb("#1e293b");
const HEADER_TEXT = hexToRgb("#ffffff");

// Mirrors app/_components/findings.tsx's SEVERITY_STYLES badge colors
// (Tailwind red/orange/amber/zinc -100/-800 pairs), so the sheet reads as
// the same visual language as the app itself rather than an unrelated palette.
const SEVERITY_COLORS: Record<string, { background: RGB; text: RGB }> = {
  blocker: { background: hexToRgb("#fee2e2"), text: hexToRgb("#991b1b") },
  high: { background: hexToRgb("#ffedd5"), text: hexToRgb("#9a3412") },
  medium: { background: hexToRgb("#fef3c7"), text: hexToRgb("#92400e") },
  low: { background: hexToRgb("#f4f4f5"), text: hexToRgb("#3f3f46") },
};

// Purely cosmetic tab-navigation colors, one per category, so a multi-tab
// workbook is easy to scan at a glance. The app has no existing
// category color mapping to mirror, unlike severity above.
const CATEGORY_TAB_COLORS: Record<string, RGB> = {
  "Theme Store Compliance": hexToRgb("#3b82f6"),
  Accessibility: hexToRgb("#a855f7"),
  "Technical SEO": hexToRgb("#22c55e"),
  "Technical AEO": hexToRgb("#14b8a6"),
  Bug: hexToRgb("#ef4444"),
  "Internal Standard": hexToRgb("#71717a"),
};

const COLUMN_WIDTHS: Record<string, number> = {
  "Audit ID": 90,
  Theme: 140,
  Severity: 90,
  "Rule ID": 220,
  "Requirement ID": 180,
  Finding: 320,
  Recommendation: 320,
  Page: 130,
  File: 200,
  Line: 60,
  Source: 220,
};

const WRAP_COLUMNS = ["Finding", "Recommendation"] as const;
const SEVERITY_COLUMN_INDEX = TAB_COLUMNS.indexOf("Severity");

// Loosely typed on purpose — these are opaque request objects passed
// straight through to the Sheets API's spreadsheets.batchUpdate. Modeling
// every variant of its Request union here would be pure ceremony for a
// single internal caller.
export type SheetFormattingRequest = Record<string, unknown>;

/**
 * One tab's worth of cosmetic formatting: a styled + frozen header row,
 * sensible column widths, text wrapping on the long Finding/Recommendation
 * columns, severity color-coding (matching the app's own badge colors),
 * zebra striping, and a per-category tab color. `dataRowCount` excludes
 * the header row and must be >= 1 (buildCategorySheetTabs never emits an
 * empty tab, so this is always true for a real tab).
 */
export function buildSheetFormattingRequests(sheetId: number, dataRowCount: number, category: string): SheetFormattingRequest[] {
  const endRowIndex = dataRowCount + 1;

  return [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
          tabColor: CATEGORY_TAB_COLORS[category] ?? CATEGORY_TAB_COLORS["Internal Standard"],
        },
        fields: "gridProperties.frozenRowCount,tabColor",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: TAB_COLUMNS.length },
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
    ...TAB_COLUMNS.map((column, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: COLUMN_WIDTHS[column] ?? 150 },
        fields: "pixelSize",
      },
    })),
    ...WRAP_COLUMNS.map((column) => {
      const columnIndex = TAB_COLUMNS.indexOf(column);
      return {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      };
    }),
    ...Object.entries(SEVERITY_COLORS).map(([severity, colors]) => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: SEVERITY_COLUMN_INDEX, endColumnIndex: SEVERITY_COLUMN_INDEX + 1 },
          ],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: severity }] },
            format: { backgroundColor: colors.background, textFormat: { foregroundColor: colors.text, bold: true } },
          },
        },
        index: 0,
      },
    })),
    {
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 1, endRowIndex, startColumnIndex: 0, endColumnIndex: TAB_COLUMNS.length },
          rowProperties: {
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.97, green: 0.97, blue: 0.98 },
          },
        },
      },
    },
  ];
}
