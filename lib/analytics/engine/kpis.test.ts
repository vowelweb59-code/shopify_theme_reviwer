import { describe, expect, it } from "vitest";
import { ALL_EVENTS } from "../constants";
import { JOURNEY_EVENTS, compareKpis, compareValues, computeKpis, computeRates, dailySeries, journeySteps, rate, sumKpis, withFunnelEvents, type DailyPoint } from "./kpis";

const p = (date: string, eventName: string, users: number, eventCount = 0, extra: Partial<DailyPoint> = {}): DailyPoint => ({
  themeId: "t1",
  date,
  eventName,
  users,
  eventCount,
  sessions: 0,
  newUsers: 0,
  ...extra,
});

// Two days of one theme.
const points: DailyPoint[] = [
  p("2026-09-01", ALL_EVENTS, 100, 900, { sessions: 120, newUsers: 60 }),
  p("2026-09-02", ALL_EVENTS, 80, 700, { sessions: 90, newUsers: 40 }),
  p("2026-09-01", "view_item", 50, 70),
  p("2026-09-02", "view_item", 30, 40),
  p("2026-09-01", "add_to_cart", 10, 12),
  p("2026-09-02", "add_to_cart", 6, 6),
  p("2026-09-01", "shopify_theme_install", 4, 4),
  p("2026-09-02", "shopify_theme_install", 1, 1),
  p("2026-09-01", "scroll", 40, 200),
];

describe("rate", () => {
  it("is a percentage, null when there's nothing to divide by", () => {
    expect(rate(1, 4)).toBe(25);
    expect(rate(0, 4)).toBe(0);
    expect(rate(3, 0)).toBeNull();
  });

  it("can exceed 100% — it's an aggregate ratio, not a journey", () => {
    expect(rate(15, 10)).toBe(150);
  });
});

describe("computeKpis", () => {
  it("sums daily users when no range-level count is available, and says so", () => {
    const k = computeKpis(points, []);
    expect(k.usersBasis).toBe("daily_sum");
    expect(k.users).toBe(180);
    expect(k.sessions).toBe(210);
    expect(k.newUsers).toBe(100);
    expect(k.themeViews).toEqual({ count: 110, users: 80 });
    expect(k.tryTheme).toEqual({ count: 18, users: 16 });
    expect(k.installs).toEqual({ count: 5, users: 5 });
  });

  it("uses GA4's range-level unique users when given, keeping event counts from the rows", () => {
    const k = computeKpis(points, [], { users: 150, eventUsers: { view_item: 70, add_to_cart: 14, shopify_theme_install: 5 } });
    expect(k.usersBasis).toBe("unique");
    expect(k.users).toBe(150);
    expect(k.themeViews).toEqual({ count: 110, users: 70 });
    expect(k.tryTheme).toEqual({ count: 18, users: 14 });
    expect(k.sessions).toBe(210); // sessions add up across days
  });

  it("computes every conversion rate from users", () => {
    const k = computeKpis(points, [], { users: 200, eventUsers: { view_item: 80, add_to_cart: 20, shopify_theme_install: 5 } });
    expect(k.rates).toEqual({
      themeViewRate: 40, // 80 / 200
      tryThemeRate: 10, // 20 / 200
      installRate: 2.5, // 5 / 200
      viewToTryTheme: 25, // 20 / 80
      viewToInstall: 6.25, // 5 / 80
      tryThemeToInstall: 25, // 5 / 20
    });
  });

  it("returns null rates, not 0%, for an empty period", () => {
    const k = computeKpis([], []);
    expect(k.users).toBe(0);
    expect(Object.values(k.rates)).toEqual([null, null, null, null, null, null]);
  });

  it("reports extra requested events and ignores unrequested ones", () => {
    expect(computeKpis(points, ["scroll"]).events.scroll).toEqual({ count: 200, users: 40 });
    expect(computeKpis(points, []).events.scroll).toBeUndefined();
  });

  it("treats an event missing from the unique counts as zero users", () => {
    expect(computeKpis(points, [], { users: 10, eventUsers: {} }).installs).toEqual({ count: 5, users: 0 });
  });
});

describe("withFunnelEvents", () => {
  it("always includes the funnel events first, de-duplicated", () => {
    expect(withFunnelEvents(["scroll", "add_to_cart"])).toEqual(["view_item", "add_to_cart", "shopify_theme_install", "scroll"]);
  });
});

describe("sumKpis", () => {
  const a = computeKpis(points, [], { users: 150, eventUsers: { view_item: 70, add_to_cart: 14, shopify_theme_install: 5 } });
  const b = computeKpis([p("2026-09-01", ALL_EVENTS, 50, 0, { sessions: 60 }), p("2026-09-01", "shopify_theme_install", 5, 5)], [], {
    users: 50,
    eventUsers: { shopify_theme_install: 5 },
  });

  it("adds users and counts, and recomputes rates from the totals (never averages them)", () => {
    const total = sumKpis([a, b], []);
    expect(total.users).toBe(200);
    expect(total.installs).toEqual({ count: 10, users: 10 });
    expect(total.rates.installRate).toBe(5); // 10 / 200, not the mean of 3.33% and 10%
    expect(total.usersBasis).toBe("unique");
  });

  it("is daily_sum if any part fell back", () => {
    expect(sumKpis([a, computeKpis(points, [])], []).usersBasis).toBe("daily_sum");
  });

  it("sums to zero for no parts", () => {
    expect(sumKpis([], []).users).toBe(0);
  });
});

describe("compareValues", () => {
  it("returns absolute and percentage change", () => {
    expect(compareValues(120, 100)).toEqual({ current: 120, previous: 100, change: 20, changePercent: 20 });
    expect(compareValues(50, 100)).toEqual({ current: 50, previous: 100, change: -50, changePercent: -50 });
  });

  it("has no percentage change from zero, except zero to zero", () => {
    expect(compareValues(5, 0).changePercent).toBeNull();
    expect(compareValues(5, 0).change).toBe(5);
    expect(compareValues(0, 0).changePercent).toBe(0);
  });

  it("propagates missing values", () => {
    expect(compareValues(null, 10)).toEqual({ current: null, previous: 10, change: null, changePercent: null });
    expect(compareValues(10, null).change).toBeNull();
  });
});

describe("compareKpis", () => {
  it("compares every numeric KPI, rates in percentage points", () => {
    const cur = computeKpis([], [], { users: 200, eventUsers: { shopify_theme_install: 10 } });
    const prev = computeKpis([], [], { users: 100, eventUsers: { shopify_theme_install: 4 } });
    const c = compareKpis(cur, prev);
    expect(c.users).toEqual({ current: 200, previous: 100, change: 100, changePercent: 100 });
    expect(c.installs.users).toEqual({ current: 10, previous: 4, change: 6, changePercent: 150 });
    expect(c.rates.installRate).toEqual({ current: 5, previous: 4, change: 1, changePercent: 25 });
    expect(c.rates.viewToInstall).toEqual({ current: null, previous: null, change: null, changePercent: null });
    expect(c.events.shopify_theme_install.count.current).toBe(0);
    expect(c).not.toHaveProperty("usersBasis");
  });
});

describe("computeRates", () => {
  it("uses users, not event counts", () => {
    expect(computeRates(100, { count: 999, users: 50 }, { count: 999, users: 10 }, { count: 999, users: 5 }).viewToTryTheme).toBe(20);
  });
});

describe("dailySeries", () => {
  it("zero-fills, and places points by index", () => {
    const series = dailySeries(points, 3, (pt) => (pt.date === "2026-09-01" ? 0 : pt.date === "2026-09-02" ? 1 : -1));
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ users: 100, sessions: 120, themeViews: { count: 70, users: 50 }, tryTheme: { count: 12, users: 10 }, installs: { count: 4, users: 4 } });
    expect(series[1].installs).toEqual({ count: 1, users: 1 });
    expect(series[2].users).toBe(0);
  });

  it("drops points outside the series", () => {
    expect(dailySeries(points, 1, () => 5)[0].users).toBe(0);
  });
});

describe("journeySteps", () => {
  const k = computeKpis([], [...JOURNEY_EVENTS], {
    users: 1000,
    eventUsers: { session_start: 900, page_view: 800, view_item: 400, add_to_cart: 100, shopify_theme_install: 120 },
  });

  it("lists the five steps in order, each against the previous and the first", () => {
    const steps = journeySteps(k);
    expect(steps.map((s) => s.eventName)).toEqual(["session_start", "page_view", "view_item", "add_to_cart", "shopify_theme_install"]);
    expect(steps[0]).toMatchObject({ users: 900, ofPrevious: null, ofFirst: null });
    expect(steps[2]).toMatchObject({ users: 400, ofPrevious: 50, ofFirst: (400 / 900) * 100 });
  });

  it("lets a later step exceed an earlier one — they're totals, not a sequence", () => {
    expect(journeySteps(k)[4].ofPrevious).toBe(120);
  });

  it("has null ratios after an empty step", () => {
    const empty = journeySteps(computeKpis([], [...JOURNEY_EVENTS]));
    expect(empty.every((s) => s.ofPrevious === null && s.users === 0)).toBe(true);
  });
});
