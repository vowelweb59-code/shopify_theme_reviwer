import { describe, expect, it } from "vitest";
import { buildSummary, type SaleInput } from "./aggregate";

const sale = (over: Partial<SaleInput>): SaleInput => ({
  themeId: "adorn",
  month: "2026-07",
  chargeType: "sale",
  amount: 270,
  share: 221.67,
  country: "US",
  shopDomain: "a.myshopify.com",
  preset: "Adorn",
  category: "jewelry-and-accessories",
  ...over,
});

const names = new Map([["adorn", "Adorn"]]);
const label = (s: string | null) => (s ? s.toUpperCase() : "Uncategorized");

describe("buildSummary", () => {
  const sales = [
    sale({}),
    sale({ shopDomain: "b.myshopify.com", preset: "Precious" }),
    sale({ month: "2026-06", shopDomain: "c.myshopify.com", preset: "Ace", category: "clothing", country: "IN" }),
    sale({ month: "2026-06", chargeType: "refund", amount: -200, share: -170, shopDomain: "c.myshopify.com", preset: "Ace", category: "clothing", country: "IN" }),
  ];
  const ga = [
    { themeId: "adorn", month: "2026-07", tryTheme: 120, installs: 40 },
    { themeId: "adorn", month: "2026-05", tryTheme: 90, installs: 30 },
  ];
  const summary = buildSummary(sales, ga, names, label);

  it("puts installs and Try Theme next to each theme's monthly sales, newest month first", () => {
    expect(summary.themeMonths.map((r) => r.month)).toEqual(["2026-07", "2026-06", "2026-05"]);
    expect(summary.themeMonths[0]).toMatchObject({ themeName: "Adorn", tryTheme: 120, installs: 40, sales: 2, netSales: 2, gross: 540, installRate: 2000 });
    // A refund cancels a sale in that month.
    expect(summary.themeMonths[1]).toMatchObject({ sales: 1, refunds: 1, netSales: 0, gross: 70, installs: 0 });
    // A month with installs but no sales still shows.
    expect(summary.themeMonths[2]).toMatchObject({ month: "2026-05", sales: 0, installs: 30 });
  });

  it("totals presets, categories and countries with the same numbers", () => {
    expect(summary.presets.find((p) => p.preset === "Ace")).toMatchObject({ sales: 1, refunds: 1, netSales: 0, stores: 1, category: "clothing" });
    expect(summary.categories.map((c) => [c.category, c.netSales])).toEqual([
      ["jewelry-and-accessories", 2],
      ["clothing", 0],
    ]);
    expect(summary.countries.find((c) => c.country === "IN")).toMatchObject({ sales: 1, refunds: 1 });
    expect(summary.totals).toMatchObject({ sales: 3, refunds: 1, netSales: 2, installs: 70, tryTheme: 210 });
  });

  it("builds category-by-month and preset-by-month matrices", () => {
    const jewelry = summary.categoryMonths.find((r) => r.key === "jewelry-and-accessories")!;
    expect(jewelry.label).toBe("JEWELRY-AND-ACCESSORIES");
    expect(jewelry.byMonth["2026-07"].netSales).toBe(2);
    expect(summary.presetMonths.find((r) => r.key === "adorn|Ace")!.byMonth["2026-06"]).toMatchObject({ sales: 1, refunds: 1 });
  });

  it("leaves install columns empty for a theme with no GA4 data", () => {
    const s = buildSummary([sale({})], [], names, label);
    expect(s.themeMonths[0]).toMatchObject({ installs: null, tryTheme: null, installRate: null });
    expect(s.totals.installs).toBeNull();
  });
});
