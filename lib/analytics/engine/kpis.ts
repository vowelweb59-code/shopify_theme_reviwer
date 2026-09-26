import { ALL_EVENTS, PRIMARY_EVENTS, THEME_VIEW_EVENT } from "../constants";

// KPI and conversion-rate calculations. Pure: inputs are daily points read
// from AnalyticsAggregate (already summed per theme × date × event) plus,
// when available, range-level unique users fetched from GA4.
//
// Two correctness rules from the architecture doc (§4) shape this file:
//   1. Unique users don't add up across days. Summing 30 daily user counts
//      counts a returning visitor up to 30 times. So "users over a range"
//      comes from GA4's own range-level count when we have it, and
//      otherwise from the daily sum, labelled usersBasis: "daily_sum".
//   2. Conversion rates are ratios of *aggregate* user counts in the same
//      period, not step-by-step journeys: "Try Theme → Install" is install
//      users ÷ try-theme users, not "people who tried and then installed".
//      A rate can therefore exceed 100%.

/** The three events the funnel is built from, in funnel order. */
export const FUNNEL_EVENTS = [THEME_VIEW_EVENT, PRIMARY_EVENTS.tryTheme, PRIMARY_EVENTS.themeInstall] as const;

/** One theme × date × event, summed over the rows matching the request's filters. */
export type DailyPoint = {
  themeId: string;
  date: string;
  eventName: string; // a tracked event, or ALL_EVENTS for property-wide totals
  eventCount: number;
  users: number;
  sessions: number;
  newUsers: number;
};

/**
 * Range-level unique users for one theme (and one group, for breakdowns), from GA4.
 * `estimated`: events GA4 wasn't asked about because their stored figures
 * are estimates (a shared property's installs); those keep the stored users.
 */
export type UniqueUsers = { users: number; eventUsers: Record<string, number>; estimated?: readonly string[] };

/**
 * "unique": users are GA4's de-duplicated count for the whole range.
 * "daily_sum": users are daily unique counts added up (user-days) — larger
 *   than the true figure whenever people return on several days.
 */
export type UsersBasis = "unique" | "daily_sum";

export type EventStat = { count: number; users: number };

export type Rates = {
  /** Theme View users ÷ users × 100 (the funnel's first step) */
  themeViewRate: number | null;
  /** Try Theme users ÷ users × 100 */
  tryThemeRate: number | null;
  /** Install users ÷ users × 100 */
  installRate: number | null;
  /** Try Theme users ÷ Theme View users × 100 */
  viewToTryTheme: number | null;
  /** Install users ÷ Theme View users × 100 */
  viewToInstall: number | null;
  /** Install users ÷ Try Theme users × 100 */
  tryThemeToInstall: number | null;
};

export type KpiSet = {
  users: number;
  sessions: number;
  newUsers: number;
  themeViews: EventStat;
  tryTheme: EventStat;
  installs: EventStat;
  rates: Rates;
  /** Every requested event (the funnel events always included). */
  events: Record<string, EventStat>;
  usersBasis: UsersBasis;
};

/** Percentage, or null when the denominator is zero (a rate of "nothing" isn't 0%). */
export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

export function computeRates(users: number, views: EventStat, tryTheme: EventStat, installs: EventStat): Rates {
  return {
    themeViewRate: rate(views.users, users),
    tryThemeRate: rate(tryTheme.users, users),
    installRate: rate(installs.users, users),
    viewToTryTheme: rate(tryTheme.users, views.users),
    viewToInstall: rate(installs.users, views.users),
    tryThemeToInstall: rate(installs.users, tryTheme.users),
  };
}

/** Requested events with the funnel events first, de-duplicated. */
export function withFunnelEvents(events: readonly string[] = []): string[] {
  return [...new Set([...FUNNEL_EVENTS, ...events])];
}

function assemble(users: number, sessions: number, newUsers: number, events: Record<string, EventStat>, usersBasis: UsersBasis): KpiSet {
  const stat = (name: string) => events[name] ?? { count: 0, users: 0 };
  const themeViews = stat(THEME_VIEW_EVENT);
  const tryTheme = stat(PRIMARY_EVENTS.tryTheme);
  const installs = stat(PRIMARY_EVENTS.themeInstall);
  return { users, sessions, newUsers, themeViews, tryTheme, installs, rates: computeRates(users, themeViews, tryTheme, installs), events, usersBasis };
}

/**
 * KPIs for one theme (or one breakdown group) over one range. `points` must
 * already be limited to that theme/group and range. With `unique`, user
 * figures are GA4's range-level counts; event counts, sessions and new users
 * always come from the points (they add up correctly across days).
 */
export function computeKpis(points: readonly DailyPoint[], events: readonly string[], unique: UniqueUsers | null = null): KpiSet {
  let users = 0;
  let sessions = 0;
  let newUsers = 0;
  const stats: Record<string, EventStat> = {};
  const names = withFunnelEvents(events);
  for (const name of names) stats[name] = { count: 0, users: 0 };

  for (const p of points) {
    if (p.eventName === ALL_EVENTS) {
      users += p.users;
      sessions += p.sessions;
      newUsers += p.newUsers;
    } else if (stats[p.eventName]) {
      stats[p.eventName].count += p.eventCount;
      stats[p.eventName].users += p.users;
    }
  }

  if (unique) {
    users = unique.users;
    for (const name of names) {
      if (!unique.estimated?.includes(name)) stats[name].users = unique.eventUsers[name] ?? 0;
    }
  }
  return assemble(users, sessions, newUsers, stats, unique ? "unique" : "daily_sum");
}

/**
 * Adds KPI sets together — All Themes, or several breakdown rows. Users are
 * summed, since separate GA4 properties share no user id to de-duplicate
 * by; callers must label the result "sum of themes". Rates are recomputed
 * from the summed counts (never averaged).
 */
export function sumKpis(sets: readonly KpiSet[], events: readonly string[]): KpiSet {
  const names = withFunnelEvents(events);
  const stats: Record<string, EventStat> = {};
  for (const name of names) stats[name] = { count: 0, users: 0 };
  let users = 0;
  let sessions = 0;
  let newUsers = 0;
  for (const s of sets) {
    users += s.users;
    sessions += s.sessions;
    newUsers += s.newUsers;
    for (const name of names) {
      stats[name].count += s.events[name]?.count ?? 0;
      stats[name].users += s.events[name]?.users ?? 0;
    }
  }
  const basis: UsersBasis = sets.length > 0 && sets.every((s) => s.usersBasis === "unique") ? "unique" : "daily_sum";
  return assemble(users, sessions, newUsers, stats, basis);
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

type Compared<T> = T extends number | null ? Change : { [K in keyof T]: Compared<T[K]> };
export type KpiComparison = Compared<Omit<KpiSet, "usersBasis">>;

function compareDeep(current: unknown, previous: unknown): unknown {
  if (current === null || typeof current === "number") return compareValues(current as number | null, (previous ?? null) as number | null);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(current as object)) {
    out[key] = compareDeep((current as Record<string, unknown>)[key], (previous as Record<string, unknown> | undefined)?.[key] ?? null);
  }
  return out;
}

/** Every numeric KPI as current / previous / change / % change. */
export function compareKpis(current: KpiSet, previous: KpiSet): KpiComparison {
  const strip = ({ usersBasis, ...rest }: KpiSet) => (void usersBasis, rest);
  return compareDeep(strip(current), strip(previous)) as KpiComparison;
}

// ---- Trends ----

export type DailyMetrics = {
  users: number;
  sessions: number;
  themeViews: EventStat;
  tryTheme: EventStat;
  installs: EventStat;
};

const emptyDay = (): DailyMetrics => ({ users: 0, sessions: 0, themeViews: { count: 0, users: 0 }, tryTheme: { count: 0, users: 0 }, installs: { count: 0, users: 0 } });

/**
 * One entry per date in `dates` (zero-filled). Daily users are exact per
 * theme; summed across themes they're a sum of per-theme users. `dayIndex`
 * maps a point to its position — by date for a single time zone, or by
 * offset from each theme's own range start when themes' "today" differ.
 */
export function dailySeries(points: readonly DailyPoint[], length: number, dayIndex: (p: DailyPoint) => number): DailyMetrics[] {
  const days = Array.from({ length }, emptyDay);
  const eventKey: Record<string, "themeViews" | "tryTheme" | "installs"> = {
    [THEME_VIEW_EVENT]: "themeViews",
    [PRIMARY_EVENTS.tryTheme]: "tryTheme",
    [PRIMARY_EVENTS.themeInstall]: "installs",
  };
  for (const p of points) {
    const i = dayIndex(p);
    if (i < 0 || i >= length) continue;
    if (p.eventName === ALL_EVENTS) {
      days[i].users += p.users;
      days[i].sessions += p.sessions;
    } else if (eventKey[p.eventName]) {
      const stat = days[i][eventKey[p.eventName]];
      stat.count += p.eventCount;
      stat.users += p.users;
    }
  }
  return days;
}

// ---- User journey ----

/** Session → Page View → Theme View → Try Theme → Theme Install, as GA4 event names. */
export const JOURNEY_EVENTS = ["session_start", "page_view", THEME_VIEW_EVENT, PRIMARY_EVENTS.tryTheme, PRIMARY_EVENTS.themeInstall] as const;

export type JourneyStep = {
  eventName: string;
  users: number;
  count: number;
  /** This step's users ÷ the previous step's users × 100 (null for the first step, or a zero denominator). */
  ofPrevious: number | null;
  /** This step's users ÷ the first step's users × 100. */
  ofFirst: number | null;
};

/**
 * The journey as aggregate step counts. Each step is "users who fired this
 * event in the period", independently — not "users who got here from the
 * previous step". GA4's aggregate reports can't follow individual people
 * through a sequence, so the ratios compare totals and can exceed 100%.
 */
export function journeySteps(kpis: KpiSet): JourneyStep[] {
  const stats = JOURNEY_EVENTS.map((eventName) => ({ eventName, ...(kpis.events[eventName] ?? { count: 0, users: 0 }) }));
  return stats.map((s, i) => ({
    eventName: s.eventName,
    users: s.users,
    count: s.count,
    ofPrevious: i === 0 ? null : rate(s.users, stats[i - 1].users),
    ofFirst: i === 0 ? null : rate(s.users, stats[0].users),
  }));
}
