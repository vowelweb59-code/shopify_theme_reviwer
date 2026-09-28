import { PRIMARY_EVENTS } from "../constants";

// KPI calculations. Pure: inputs are points read from AnalyticsAggregate
// (already summed per theme × date × event). Only two events are stored —
// Try Theme (add_to_cart) and installs — as event counts, which add up
// correctly across days, dimension values and themes.
//
// The install rate is installs ÷ Try Theme clicks over the same period. It
// compares totals, not people (GA4's aggregate data doesn't follow anyone
// from a click to an install), so it can exceed 100%.

/** One theme × date × event, summed over the rows matching the request's filters. */
export type DailyPoint = {
  themeId: string;
  date: string;
  eventName: string;
  eventCount: number;
};

export type KpiSet = {
  /** Try Theme clicks (GA4 add_to_cart events). */
  tryTheme: number;
  /** Theme installs (shopify_theme_install events). */
  installs: number;
  /** installs ÷ Try Theme clicks × 100; null with no clicks. */
  installRate: number | null;
};

/** Percentage, or null when the denominator is zero (a rate of "nothing" isn't 0%). */
export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

const assemble = (tryTheme: number, installs: number): KpiSet => ({ tryTheme, installs, installRate: rate(installs, tryTheme) });

/** KPIs for one theme (or one breakdown group) over one range. `points` must already be limited to it. */
export function computeKpis(points: readonly DailyPoint[]): KpiSet {
  let tryTheme = 0;
  let installs = 0;
  for (const p of points) {
    if (p.eventName === PRIMARY_EVENTS.tryTheme) tryTheme += p.eventCount;
    else if (p.eventName === PRIMARY_EVENTS.themeInstall) installs += p.eventCount;
  }
  return assemble(tryTheme, installs);
}

/** Adds KPI sets together (All Themes, or several breakdown rows). The rate is recomputed, never averaged. */
export function sumKpis(sets: readonly KpiSet[]): KpiSet {
  return assemble(
    sets.reduce((n, s) => n + s.tryTheme, 0),
    sets.reduce((n, s) => n + s.installs, 0)
  );
}

// ---- Period comparison ----

export type Change = {
  current: number | null;
  previous: number | null;
  /** current − previous (percentage points, for rates). */
  change: number | null;
  /** change ÷ previous × 100; null when previous is 0 or missing (no meaningful %). */
  changePercent: number | null;
};

export function compareValues(current: number | null, previous: number | null): Change {
  if (current === null || previous === null) return { current, previous, change: null, changePercent: null };
  const change = current - previous;
  return { current, previous, change, changePercent: previous === 0 ? (current === 0 ? 0 : null) : (change / previous) * 100 };
}

export type KpiComparison = { [K in keyof KpiSet]: Change };

/** Every KPI as current / previous / change / % change. */
export function compareKpis(current: KpiSet, previous: KpiSet): KpiComparison {
  return {
    tryTheme: compareValues(current.tryTheme, previous.tryTheme),
    installs: compareValues(current.installs, previous.installs),
    installRate: compareValues(current.installRate, previous.installRate),
  };
}

// ---- Trends ----

export type DailyMetrics = { tryTheme: number; installs: number };

/**
 * One entry per day of the range (zero-filled). `dayIndex` maps a point to
 * its position — by date for a single time zone, or by offset from each
 * theme's own range start when themes' "today" differ.
 */
export function dailySeries(points: readonly DailyPoint[], length: number, dayIndex: (p: DailyPoint) => number): DailyMetrics[] {
  const days: DailyMetrics[] = Array.from({ length }, () => ({ tryTheme: 0, installs: 0 }));
  for (const p of points) {
    const i = dayIndex(p);
    if (i < 0 || i >= length) continue;
    if (p.eventName === PRIMARY_EVENTS.tryTheme) days[i].tryTheme += p.eventCount;
    else if (p.eventName === PRIMARY_EVENTS.themeInstall) days[i].installs += p.eventCount;
  }
  return days;
}
