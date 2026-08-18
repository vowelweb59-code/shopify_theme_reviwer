import { describe, expect, it } from "vitest";
import { buildCategorySheetTabs } from "./sheetRows";

describe("buildCategorySheetTabs", () => {
  it("groups findings into one tab per category, each with its own header row", () => {
    const tabs = buildCategorySheetTabs("audit-1", "Dawn", [
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
      {
        ruleId: "SHOPIFY-SEO-METADATA-001",
        filePath: "layout/theme.liquid",
        category: "Technical SEO",
        severity: "medium",
        finding: "No meta description",
        sourceReference: "General SEO best practice",
      },
      {
        ruleId: "A11Y-CONTRAST-001",
        filePath: "assets/base.css",
        category: "Accessibility",
        severity: "low",
        finding: "Low contrast text",
      },
    ]);

    // Ordered by FINDING_CATEGORIES' canonical order (Theme Store
    // Compliance, Accessibility, Technical SEO, ...), not first-seen.
    expect(tabs.map((t) => t.title)).toEqual(["Accessibility", "Technical SEO"]);

    const accessibilityTab = tabs[0];
    expect(accessibilityTab.rows[0]).toEqual([
      "Audit ID",
      "Theme",
      "Severity",
      "Rule ID",
      "Requirement ID",
      "Finding",
      "Recommendation",
      "Page",
      "File",
      "Line",
      "Source",
    ]);
    expect(accessibilityTab.rows).toHaveLength(3); // header + 2 accessibility findings
    expect(accessibilityTab.rows[1]).toEqual([
      "audit-1",
      "Dawn",
      "high",
      "A11Y-IMG-ALT-001",
      "SHOPIFY-A11Y-001",
      "Missing alt text",
      "Add alt text",
      "",
      "sections/header.liquid",
      "12",
      "https://example.com",
    ]);

    const seoTab = tabs[1];
    expect(seoTab.rows).toHaveLength(2); // header + 1 SEO finding
    expect(seoTab.rows[1]).toEqual([
      "audit-1",
      "Dawn",
      "medium",
      "SHOPIFY-SEO-METADATA-001",
      "",
      "No meta description",
      "",
      "Every page (layout)",
      "layout/theme.liquid",
      "",
      "General SEO best practice",
    ]);
  });

  it("omits categories with no findings rather than emitting empty tabs", () => {
    const tabs = buildCategorySheetTabs("audit-1", "Dawn", [
      { ruleId: "RULE-001", filePath: "layout/theme.liquid", category: "Bug", severity: "low", finding: "Something" },
    ]);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe("Bug");
  });

  it("returns no tabs when there are no findings", () => {
    expect(buildCategorySheetTabs("audit-1", "Dawn", [])).toEqual([]);
  });
});
