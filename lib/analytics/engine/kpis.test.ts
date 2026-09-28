import { describe, expect, it } from "vitest";
import { compareKpis, compareValues, computeKpis, dailySeries, rate, sumKpis, type DailyPoint } from "./kpis";

const p = (date: string, eventName: string, eventCount: number): DailyPoint => ({ themeId: "t1", date, eventName, eventCount });

// Two days of one theme.
const points: DailyPoint[] = [
  p("2026-09-01", "add_to_cart", 30),
  p("2026-09-02", "add_to_cart", 10),
  p("2026-09-01", "shopify_theme_install", 3),
  p("2026-09-02", "shopify_theme_install", 1),
  p("2026-09-01", "page_view", 900), // not a tracked event: ignored
];

describe("rate", () => {
  it("is a percentage, null when there's nothing to divide by", () => {
    expect(rate(1, 4)).toBe(25);
    expect(rate(3, 0)).toBeNull();
  });

  it("can exceed 100% — it's an aggregate ratio, not a journey", () => {
    expect(rate(5, 4)).toBe(125);
  });
});

describe("computeKpis", () => {
  it("sums Try Theme clicks and installs, and divides them for the install rate", () => {
    expect(computeKpis(points)).toEqual({ tryTheme: 40, installs: 4, installRate: 10 });
  });

  it("returns a null rate, not 0%, for an empty period", () => {
    expect(computeKpis([])).toEqual({ tryTheme: 0, installs: 0, installRate: null });
  });
});

describe("sumKpis", () => {
  it("adds the counts and recomputes the rate from the totals (never averages it)", () => {
    const a = computeKpis([p("d", "add_to_cart", 10), p("d", "shopify_theme_install", 5)]); // 50%
    const b = computeKpis([p("d", "add_to_cart", 90), p("d", "shopify_theme_install", 5)]); // ~5.6%
    expect(sumKpis([a, b])).toEqual({ tryTheme: 100, installs: 10, installRate: 10 });
  });

  it("sums to zero for no parts", () => {
    expect(sumKpis([])).toEqual({ tryTheme: 0, installs: 0, installRate: null });
  });
});

describe("compareValues", () => {
  it("returns absolute and percentage change", () => {
    expect(compareValues(150, 100)).toEqual({ current: 150, previous: 100, change: 50, changePercent: 50 });
  });

  it("has no percentage change from zero, except zero to zero", () => {
    expect(compareValues(5, 0).changePercent).toBeNull();
    expect(compareValues(0, 0).changePercent).toBe(0);
  });

  it("propagates missing values", () => {
    expect(compareValues(null, 5)).toEqual({ current: null, previous: 5, change: null, changePercent: null });
  });
});

describe("compareKpis", () => {
  it("compares every KPI, the rate in percentage points", () => {
    const c = compareKpis({ tryTheme: 40, installs: 4, installRate: 10 }, { tryTheme: 20, installs: 4, installRate: 20 });
    expect(c.tryTheme).toEqual({ current: 40, previous: 20, change: 20, changePercent: 100 });
    expect(c.installRate).toMatchObject({ change: -10 });
  });
});

describe("dailySeries", () => {
  it("zero-fills, and places points by index", () => {
    const days = dailySeries(points, 3, (pt) => (pt.date === "2026-09-01" ? 0 : 2));
    expect(days).toEqual([
      { tryTheme: 30, installs: 3 },
      { tryTheme: 0, installs: 0 },
      { tryTheme: 10, installs: 1 },
    ]);
  });

  it("drops points outside the series", () => {
    expect(dailySeries(points, 1, () => 5)).toEqual([{ tryTheme: 0, installs: 0 }]);
  });
});
