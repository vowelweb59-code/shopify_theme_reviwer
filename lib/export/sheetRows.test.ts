import { describe, expect, it } from "vitest";
import { buildChecklistSheetTabs, parseChecklistRow, TAB_COLUMNS } from "./sheetRows";
import type { DiffFinding } from "@/lib/audit/diffFindings";
import type { SheetChecklistFinding } from "./sheetRows";

const altText: SheetChecklistFinding = {
  ruleId: "A11Y-IMG-ALT-001",
  requirementId: "SHOPIFY-A11Y-001",
  filePath: "sections/header.liquid",
  lineNumber: 12,
  category: "Accessibility",
  severity: "high",
  finding: "Missing alt text",
  recommendation: "Add alt text",
  sourceUrl: "https://example.com",
};

const metaDescription: SheetChecklistFinding = {
  ruleId: "SHOPIFY-SEO-METADATA-001",
  filePath: "layout/theme.liquid",
  category: "Technical SEO",
  severity: "medium",
  finding: "No meta description",
  sourceReference: "General SEO best practice",
};

const contrast: SheetChecklistFinding = {
  ruleId: "A11Y-CONTRAST-001",
  filePath: "assets/base.css",
  category: "Accessibility",
  severity: "low",
  finding: "Low contrast text",
};

describe("buildChecklistSheetTabs", () => {
  it("groups diff findings into one tab per category, each with its own header row", () => {
    const diffFindings: DiffFinding<SheetChecklistFinding>[] = [
      { status: "still_present", previous: altText, current: altText },
      { status: "resolved", previous: metaDescription },
      { status: "new", current: contrast },
    ];
    const tabs = buildChecklistSheetTabs("audit-1", "Dawn", diffFindings);

    // Ordered by FINDING_CATEGORIES' canonical order (Theme Store
    // Compliance, Accessibility, Technical SEO, ...), not first-seen.
    expect(tabs.map((t) => t.title)).toEqual(["Accessibility", "Technical SEO"]);

    const accessibilityTab = tabs[0];
    expect(accessibilityTab.rows[0]).toEqual([...TAB_COLUMNS]);
    expect(accessibilityTab.rows).toHaveLength(3); // header + 2 accessibility findings
    expect(accessibilityTab.rows[1]).toEqual([
      "audit-1",
      "Dawn",
      "high",
      "Still Open",
      "FALSE",
      "A11Y-IMG-ALT-001",
      "SHOPIFY-A11Y-001",
      "Missing alt text",
      "Add alt text",
      "",
      "sections/header.liquid",
      "12",
      "https://example.com",
    ]);
    expect(accessibilityTab.rows[2]).toEqual([
      "audit-1",
      "Dawn",
      "low",
      "New",
      "FALSE",
      "A11Y-CONTRAST-001",
      "",
      "Low contrast text",
      "",
      "",
      "assets/base.css",
      "",
      "",
    ]);

    const seoTab = tabs[1];
    expect(seoTab.rows).toHaveLength(2); // header + 1 SEO finding
    expect(seoTab.rows[1]).toEqual([
      "audit-1",
      "Dawn",
      "medium",
      "Resolved",
      "TRUE",
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

  it("omits categories with no diff entries rather than emitting empty tabs", () => {
    const tabs = buildChecklistSheetTabs("audit-1", "Dawn", [
      { status: "new", current: { ruleId: "RULE-001", filePath: "layout/theme.liquid", category: "Bug", severity: "low", finding: "Something" } },
    ]);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe("Bug");
  });

  it("returns no tabs when there are no diff findings", () => {
    expect(buildChecklistSheetTabs("audit-1", "Dawn", [])).toEqual([]);
  });
});

describe("parseChecklistRow", () => {
  it("reconstructs the resolved state and a signature matching the same finding built fresh", () => {
    const tabs = buildChecklistSheetTabs("audit-1", "Dawn", [{ status: "resolved", previous: altText }]);
    const row = tabs[0].rows[1];
    const parsed = parseChecklistRow(row, "Accessibility");
    expect(parsed.isResolved).toBe(true);

    const freshTabs = buildChecklistSheetTabs("audit-2", "Dawn", [{ status: "still_present", previous: altText, current: altText }]);
    const freshRow = freshTabs[0].rows[1];
    expect(parseChecklistRow(freshRow, "Accessibility").signature).toBe(parsed.signature);
  });

  it("reports isResolved false for a still-open or new row", () => {
    const tabs = buildChecklistSheetTabs("audit-1", "Dawn", [{ status: "new", current: contrast }]);
    const parsed = parseChecklistRow(tabs[0].rows[1], "Accessibility");
    expect(parsed.isResolved).toBe(false);
  });
});
