import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildReportXlsx } from "./xlsx";

describe("buildReportXlsx", () => {
  it("produces a workbook with a sheet per category plus Summary/Findings/Coverage/Diagnostics", async () => {
    const buffer = await buildReportXlsx({
      themeName: "Adorn",
      auditRunId: "run1",
      summary: { total: 1, blocker: 0, high: 1, medium: 0, low: 0 },
      findings: [
        {
          ruleId: "A11Y-IMG-ALT-001",
          filePath: "sections/hero.liquid",
          category: "Accessibility",
          severity: "high",
          finding: "Missing alt attribute.",
        },
      ],
      coverage: { total: 10, implemented: 5, partial: 0, notImplemented: 5, percentage: 50 },
      coverageByCategory: { Accessibility: { total: 5, implemented: 3, partial: 0, notImplemented: 2, percentage: 60 } },
      diagnostics: { parserWarnings: 0, unresolvedDynamicReferences: 1, filesSkipped: 0, rulesSkippedDueToError: 0 },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheetNames = workbook.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual(
      expect.arrayContaining(["Summary", "Findings", "Shopify Compliance", "Accessibility", "Technical SEO", "Rule Coverage", "Diagnostics"])
    );
  });

  it("puts each finding on the sheet matching its category, not just the combined Findings sheet", async () => {
    const buffer = await buildReportXlsx({
      themeName: "Adorn",
      auditRunId: "run1",
      summary: { total: 1, blocker: 0, high: 0, medium: 1, low: 0 },
      findings: [
        {
          ruleId: "REF-ASSET-MISSING-001",
          filePath: "sections/hero.liquid",
          category: "Bug",
          severity: "medium",
          finding: "Missing asset.",
        },
      ],
      coverage: { total: 1, implemented: 1, partial: 0, notImplemented: 0, percentage: 100 },
      coverageByCategory: {},
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const bugsSheet = workbook.getWorksheet("Bugs")!;
    expect(bugsSheet.rowCount).toBe(2); // header + 1 finding
    const accessibilitySheet = workbook.getWorksheet("Accessibility")!;
    expect(accessibilitySheet.rowCount).toBe(1); // header only
  });

  it("omits the Diagnostics sheet when no diagnostics are provided", async () => {
    const buffer = await buildReportXlsx({
      themeName: "Adorn",
      auditRunId: "run1",
      summary: { total: 0, blocker: 0, high: 0, medium: 0, low: 0 },
      findings: [],
      coverage: { total: 0, implemented: 0, partial: 0, notImplemented: 0, percentage: 0 },
      coverageByCategory: {},
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Diagnostics")).toBeUndefined();
  });
});
