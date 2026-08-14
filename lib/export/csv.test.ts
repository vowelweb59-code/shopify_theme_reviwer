import { describe, expect, it } from "vitest";
import { buildFindingsCsv, type CsvFindingRow } from "./csv";

function row(overrides: Partial<CsvFindingRow>): CsvFindingRow {
  return {
    ruleId: "A11Y-IMG-ALT-001",
    requirementId: "SHOPIFY-A11Y-001",
    filePath: "sections/product-card.liquid",
    lineNumber: 42,
    category: "Accessibility",
    severity: "high",
    finding: "Image is missing an alt attribute.",
    recommendation: "Add an alt attribute.",
    sourceUrl: "https://example.com/req",
    ...overrides,
  };
}

describe("buildFindingsCsv", () => {
  it("writes a header row followed by one row per finding", () => {
    const csv = buildFindingsCsv("run1", "Adorn", [row({})]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Audit ID,Theme,Severity,Category,Rule ID,Requirement ID,Finding,Recommendation,File,Line,Source"
    );
    expect(lines[1]).toContain("run1,Adorn,high,Accessibility,A11Y-IMG-ALT-001");
  });

  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    const csv = buildFindingsCsv(
      "run1",
      "Adorn",
      [row({ finding: 'Text says "hello, world"\nwith a line break' })]
    );
    expect(csv).toContain('"Text says ""hello, world""\nwith a line break"');
  });

  it("falls back to sourceReference when sourceUrl is absent", () => {
    const csv = buildFindingsCsv("run1", "Adorn", [row({ sourceUrl: null, sourceReference: "Internal standard" })]);
    expect(csv).toContain("Internal standard");
  });

  it("renders an empty string for missing optional fields", () => {
    const csv = buildFindingsCsv(
      "run1",
      "Adorn",
      [row({ requirementId: null, lineNumber: null, recommendation: null, sourceUrl: null, sourceReference: null })]
    );
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.split(",").filter((f) => f === "").length).toBeGreaterThanOrEqual(3);
  });
});
