import { describe, expect, it } from "vitest";
import { computeScoreboard } from "./computeScoreboard";
import type { CategoryChecks, CheckItem } from "./deriveChecksForAuditRun";

function item(category: string, status: CheckItem["status"], overrides: Partial<CheckItem> = {}): CheckItem {
  return {
    key: `${category}-${Math.random()}`,
    requirementId: null,
    ruleId: null,
    title: "t",
    description: "d",
    category,
    sourceName: null,
    sourceUrl: null,
    status,
    recommendation: null,
    evidence: [],
    ...overrides,
  };
}

function categories(items: CheckItem[]): CategoryChecks[] {
  const byCategory = new Map<string, CheckItem[]>();
  for (const i of items) byCategory.set(i.category, [...(byCategory.get(i.category) ?? []), i]);
  return Array.from(byCategory.entries()).map(([category, items]) => ({ category, items }));
}

const baseArgs = {
  categories: [] as CategoryChecks[],
  pageSpeed: undefined,
  enhancementDetections: undefined,
  enhancementPoints: [] as { pointId: string; themeCount?: number | null }[],
};

describe("computeScoreboard", () => {
  it("returns exactly 8 cards in the documented order", () => {
    const cards = computeScoreboard(baseArgs);
    expect(cards.map((c) => c.id)).toEqual([
      "desktop-performance",
      "mobile-performance",
      "accessibility",
      "seo",
      "store-requirement",
      "internal-standards",
      "features",
      "opportunities",
    ]);
  });

  it("computes a category score as passed/total, and null when the category has no checks", () => {
    const cards = computeScoreboard({
      ...baseArgs,
      categories: categories([item("Accessibility", "PASS"), item("Accessibility", "PASS"), item("Accessibility", "FAIL"), item("Accessibility", "NOT_TESTED")]),
    });
    const accessibility = cards.find((c) => c.id === "accessibility")!;
    expect(accessibility.score).toBe(50); // 2 of 4 passed
    expect(accessibility.detail).toBe("2 of 4 passed");

    const seo = cards.find((c) => c.id === "seo")!;
    expect(seo.score).toBeNull();
  });

  it("combines Technical SEO and Technical AEO into one SEO score", () => {
    const cards = computeScoreboard({
      ...baseArgs,
      categories: categories([item("Technical SEO", "PASS"), item("Technical AEO", "FAIL")]),
    });
    const seo = cards.find((c) => c.id === "seo")!;
    expect(seo.score).toBe(50);
    expect(seo.detail).toBe("1 of 2 passed");
  });

  it("averages performanceScore per strategy and reports null when none is defined", () => {
    const cards = computeScoreboard({
      ...baseArgs,
      pageSpeed: [
        { label: "A", url: "https://a", pageType: "home", strategy: "desktop", performanceScore: 80 },
        { label: "A", url: "https://a", pageType: "collection", strategy: "desktop", performanceScore: 60 },
        { label: "A", url: "https://a", pageType: "home", strategy: "mobile" },
      ],
    });
    const desktop = cards.find((c) => c.id === "desktop-performance")!;
    expect(desktop.score).toBe(70);

    const mobile = cards.find((c) => c.id === "mobile-performance")!;
    expect(mobile.score).toBeNull();
    expect(mobile.detail).toMatch(/PAGESPEED_API_KEY/);
  });

  it("reports 'not tested' for performance when no pageSpeed entries exist at all", () => {
    const cards = computeScoreboard(baseArgs);
    const desktop = cards.find((c) => c.id === "desktop-performance")!;
    expect(desktop.score).toBeNull();
    expect(desktop.detail).toMatch(/Not tested/);
  });

  it("computes Features coverage over only checked features, not the full catalog", () => {
    const cards = computeScoreboard({
      ...baseArgs,
      // TREND-DISCOVERY-007 backs "in-store-pickups"; TREND-CART-001 backs "slide-out-cart".
      enhancementDetections: [
        { pointId: "TREND-DISCOVERY-007", detected: true },
        { pointId: "TREND-CART-001", detected: false },
      ],
    });
    const features = cards.find((c) => c.id === "features")!;
    expect(features.score).toBe(50);
    expect(features.detail).toContain("2 checked features covered");
  });

  it("reports Features as null when nothing has been checked yet", () => {
    const cards = computeScoreboard(baseArgs);
    expect(cards.find((c) => c.id === "features")!.score).toBeNull();
  });

  it("computes Opportunities from detected/(detected+notDetected), excluding not-yet-checked points", () => {
    const cards = computeScoreboard({
      ...baseArgs,
      enhancementDetections: [
        { pointId: "P1", detected: true },
        { pointId: "P2", detected: false },
      ],
      enhancementPoints: [{ pointId: "P1" }, { pointId: "P2" }, { pointId: "P3" }],
    });
    const opportunities = cards.find((c) => c.id === "opportunities")!;
    expect(opportunities.score).toBe(50);
    expect(opportunities.detail).toBe("1 of 2 future-update opportunities already covered");
  });

  it("reports Opportunities as null when detection was never run for this audit", () => {
    const cards = computeScoreboard({ ...baseArgs, enhancementPoints: [{ pointId: "P1" }] });
    const opportunities = cards.find((c) => c.id === "opportunities")!;
    expect(opportunities.score).toBeNull();
    expect(opportunities.detail).toMatch(/Re-run/);
  });
});
