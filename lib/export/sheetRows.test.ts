import { describe, expect, it } from "vitest";
import { buildFindingsSheetRows } from "./sheetRows";

describe("buildFindingsSheetRows", () => {
  it("returns a header row followed by one row per finding", () => {
    const rows = buildFindingsSheetRows("audit-1", "Dawn", [
      {
        ruleId: "A11Y-IMG-ALT-001",
        requirementId: "SHOPIFY-A11Y-001",
        filePath: "sections/header.liquid",
        lineNumber: 12,
        category: "Accessibility",
        severity: "high",
        finding: "Missing alt text",
        recommendation: "Add alt text",
        sourceUrl: "https://example.com",
      },
    ]);

    expect(rows[0]).toEqual([
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
    ]);
    expect(rows[1]).toEqual([
      "audit-1",
      "Dawn",
      "high",
      "Accessibility",
      "A11Y-IMG-ALT-001",
      "SHOPIFY-A11Y-001",
      "Missing alt text",
      "Add alt text",
      "sections/header.liquid",
      "12",
      "https://example.com",
    ]);
  });

  it("falls back to sourceReference when sourceUrl is absent, and blanks missing optional fields", () => {
    const rows = buildFindingsSheetRows("audit-1", "Dawn", [
      {
        ruleId: "RULE-001",
        filePath: "layout/theme.liquid",
        category: "Bug",
        severity: "low",
        finding: "Something",
        sourceReference: "Internal standard",
      },
    ]);

    expect(rows[1]).toEqual([
      "audit-1",
      "Dawn",
      "low",
      "Bug",
      "RULE-001",
      "",
      "Something",
      "",
      "layout/theme.liquid",
      "",
      "Internal standard",
    ]);
  });
});
