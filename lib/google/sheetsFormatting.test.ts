import { describe, expect, it } from "vitest";
import { buildSheetFormattingRequests } from "./sheetsFormatting";

function findRequests<T extends string>(requests: Record<string, unknown>[], key: T) {
  return requests.filter((r) => key in r).map((r) => r[key]);
}

describe("buildSheetFormattingRequests", () => {
  it("freezes the header row and sets a tab color for a known category", () => {
    const requests = buildSheetFormattingRequests(42, 5, "Accessibility");
    const [updateProps] = findRequests(requests, "updateSheetProperties") as any[];

    expect(updateProps.properties.sheetId).toBe(42);
    expect(updateProps.properties.gridProperties.frozenRowCount).toBe(1);
    expect(updateProps.properties.tabColor).toEqual({ red: 168 / 255, green: 85 / 255, blue: 247 / 255 });
  });

  it("falls back to the Internal Standard tab color for an unrecognized category", () => {
    const requests = buildSheetFormattingRequests(1, 3, "Something Unrecognized");
    const [updateProps] = findRequests(requests, "updateSheetProperties") as any[];
    expect(updateProps.properties.tabColor).toEqual({ red: 113 / 255, green: 113 / 255, blue: 122 / 255 });
  });

  it("styles the full header row width", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const [headerRule] = findRequests(requests, "repeatCell").filter(
      (r: any) => r.range.startRowIndex === 0
    ) as any[];

    expect(headerRule.range).toEqual({ sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 13 });
    expect(headerRule.cell.userEnteredFormat.textFormat.bold).toBe(true);
  });

  it("sets one column-width request per column, in TAB_COLUMNS order", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const widths = findRequests(requests, "updateDimensionProperties") as any[];
    expect(widths).toHaveLength(13);
    expect(widths[0].range).toEqual({ sheetId: 1, dimension: "COLUMNS", startIndex: 0, endIndex: 1 });
    // "Finding" (index 7) and "Recommendation" (index 8) get the widest columns.
    expect(widths[7].properties.pixelSize).toBe(320);
    expect(widths[8].properties.pixelSize).toBe(320);
  });

  it("wraps text only on the Finding and Recommendation columns, over the data rows only", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const wraps = findRequests(requests, "repeatCell").filter((r: any) => r.range.startRowIndex === 1) as any[];
    expect(wraps).toHaveLength(2);
    expect(wraps[0].range.startColumnIndex).toBe(7); // Finding
    expect(wraps[1].range.startColumnIndex).toBe(8); // Recommendation
    for (const w of wraps) {
      expect(w.range.endRowIndex).toBe(6); // dataRowCount(5) + 1
      expect(w.cell.userEnteredFormat.wrapStrategy).toBe("WRAP");
    }
  });

  it("adds a conditional format rule for each of the 4 severities on the Severity column", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const rules = findRequests(requests, "addConditionalFormatRule") as any[];
    const severityRules = rules.filter((r) => r.rule.ranges[0].startColumnIndex === 2);
    expect(severityRules).toHaveLength(4);
    const severityValues = severityRules.map((r) => r.rule.booleanRule.condition.values[0].userEnteredValue);
    expect(severityValues.sort()).toEqual(["blocker", "high", "low", "medium"]);
  });

  it("adds a conditional format rule for each of the 4 diff statuses on the Status column", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const rules = findRequests(requests, "addConditionalFormatRule") as any[];
    const statusRules = rules.filter((r) => r.rule.ranges[0].startColumnIndex === 3);
    expect(statusRules).toHaveLength(4);
    const statusValues = statusRules.map((r) => r.rule.booleanRule.condition.values[0].userEnteredValue);
    expect(statusValues.sort()).toEqual(["Changed", "New", "Resolved", "Still Open"]);
  });

  it("renders the Resolved column as a checkbox over the data rows only", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const [validation] = findRequests(requests, "setDataValidation") as any[];
    expect(validation.range).toEqual({ sheetId: 1, startRowIndex: 1, endRowIndex: 6, startColumnIndex: 4, endColumnIndex: 5 });
    expect(validation.rule.condition.type).toBe("BOOLEAN");
  });

  it("bands the data rows only, excluding the header", () => {
    const requests = buildSheetFormattingRequests(1, 5, "Bug");
    const [banding] = findRequests(requests, "addBanding") as any[];
    expect(banding.bandedRange.range).toEqual({
      sheetId: 1,
      startRowIndex: 1,
      endRowIndex: 6,
      startColumnIndex: 0,
      endColumnIndex: 13,
    });
  });
});
