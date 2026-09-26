import { AGGREGATE_BREAKDOWNS, ALL_EVENTS, PRIMARY_EVENTS, THEME_VIEW_EVENT, TRACKED_EVENTS, buildDimsKey, type AggregateBreakdown, type AggregateDimension } from "../constants";
import { fromGa4Date } from "./dates";
import type { ReportRequest, ReportRow } from "./ga4Client";

// Which GA4 reports one sync chunk runs, and how their rows become
// AnalyticsAggregate rows. Two reports per breakdown:
//   "events": date x eventName x breakdown dims, for the tracked events
//             only — eventCount plus the unique users who fired each event.
//   "totals": date x breakdown dims across all events — the property's own
//             users/sessions, stored under eventName ALL_EVENTS.
// Keeping them separate matters: users who fired *any* event can't be
// derived by adding per-event users together.
//
// A theme that shares its property with another theme has a page path
// prefix (e.g. "/themes/adorn/"), applied to every report so only its own
// pages' events count. Installs carry no page at all, so for such a theme
// they're estimated separately (installEstimateRequest below).

export type ReportKind = "events" | "totals";

const EVENT_METRICS = ["eventCount", "totalUsers"] as const;
const TOTAL_METRICS = ["totalUsers", "activeUsers", "newUsers", "sessions", "eventCount"] as const;

export type ReportSpec = { breakdown: AggregateBreakdown; kind: ReportKind; request: ReportRequest };

type Filter = NonNullable<ReportRequest["dimensionFilter"]>;

/** Case-insensitive: GA4 records some paths with capitals (e.g. /themes/Flaunt/presets/Flaunt). */
export function pagePathFilter(prefix: string): Filter {
  return { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: prefix, caseSensitive: false } } };
}

/** ANDs the filters that are present; undefined when none are. */
export function allOf(...filters: (Filter | null | undefined)[]): Filter | undefined {
  const present = filters.filter((f): f is Filter => Boolean(f));
  if (present.length === 0) return undefined;
  return present.length === 1 ? present[0] : { andGroup: { expressions: present } };
}

export function buildReportSpecs(range: { start: string; end: string }, pagePathPrefix: string | null = null): ReportSpec[] {
  const pageFilter = pagePathPrefix ? pagePathFilter(pagePathPrefix) : null;
  const specs: ReportSpec[] = [];
  for (const breakdown of Object.keys(AGGREGATE_BREAKDOWNS) as AggregateBreakdown[]) {
    const dims = AGGREGATE_BREAKDOWNS[breakdown] as readonly AggregateDimension[];
    const dateRanges = [{ startDate: range.start, endDate: range.end }];
    specs.push({
      breakdown,
      kind: "events",
      request: {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "eventName" }, ...dims.map((name) => ({ name }))],
        metrics: EVENT_METRICS.map((name) => ({ name })),
        dimensionFilter: allOf({ filter: { fieldName: "eventName", inListFilter: { values: [...TRACKED_EVENTS] } } }, pageFilter),
      },
    });
    specs.push({
      breakdown,
      kind: "totals",
      request: {
        dateRanges,
        dimensions: [{ name: "date" }, ...dims.map((name) => ({ name }))],
        metrics: TOTAL_METRICS.map((name) => ({ name })),
        dimensionFilter: allOf(pageFilter),
      },
    });
  }
  return specs;
}

// ---- Install estimates for a theme on a shared property ----

const ESTIMATE_EVENTS = [PRIMARY_EVENTS.themeInstall, PRIMARY_EVENTS.tryTheme, THEME_VIEW_EVENT] as const;

/** date × eventName, with no page filter: the whole property's installs, Try Theme and views. */
export function installEstimateRequest(range: { start: string; end: string }): ReportRequest {
  return {
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: EVENT_METRICS.map((name) => ({ name })),
    dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [...ESTIMATE_EVENTS] } } },
  };
}

type DailyEventCounts = Map<string, Partial<Record<string, number>>>;

function countsByDate(rows: readonly { date: string; eventName: string; metrics: { eventCount: number } }[]): DailyEventCounts {
  const out: DailyEventCounts = new Map();
  for (const r of rows) {
    const day = out.get(r.date) ?? {};
    day[r.eventName] = (day[r.eventName] ?? 0) + r.metrics.eventCount;
    out.set(r.date, day);
  }
  return out;
}

/**
 * The theme's share of each day's property-wide installs: the day's Try
 * Theme share, or — on a day with no Try Theme clicks anywhere — its Try
 * Theme share over the whole chunk, then its Theme View share. Returned
 * as `total` rows (estimates are fractional; installs have no breakdown
 * dimensions to split by, so no other breakdown gets rows).
 *
 * `themeRows` are the theme's page-filtered "total" events rows; `property`
 * is the installEstimateRequest report.
 */
export function estimateInstallRows(themeRows: readonly AggregateRow[], property: readonly ReportRow[]): AggregateRow[] {
  const theme = countsByDate(themeRows.filter((r) => r.breakdown === "total"));
  const propertyRows = property.map((row) => ({ date: fromGa4Date(row.dimensions[0]), eventName: row.dimensions[1], metrics: { eventCount: row.metrics[0], totalUsers: row.metrics[1] } }));
  const whole = countsByDate(propertyRows);

  const sum = (m: DailyEventCounts, event: string) => [...m.values()].reduce((n, day) => n + (day[event] ?? 0), 0);
  const share = (mine: number, all: number) => (all > 0 ? Math.min(1, mine / all) : null);
  const chunkShare =
    share(sum(theme, PRIMARY_EVENTS.tryTheme), sum(whole, PRIMARY_EVENTS.tryTheme)) ?? share(sum(theme, THEME_VIEW_EVENT), sum(whole, THEME_VIEW_EVENT)) ?? 0;

  const out: AggregateRow[] = [];
  for (const r of propertyRows) {
    if (r.eventName !== PRIMARY_EVENTS.themeInstall || r.metrics.eventCount <= 0) continue;
    const dayShare = share(theme.get(r.date)?.[PRIMARY_EVENTS.tryTheme] ?? 0, whole.get(r.date)?.[PRIMARY_EVENTS.tryTheme] ?? 0) ?? chunkShare;
    if (dayShare <= 0) continue;
    out.push({
      date: r.date,
      breakdown: "total",
      eventName: PRIMARY_EVENTS.themeInstall,
      dims: {},
      dimsKey: buildDimsKey("total", {}),
      metrics: { eventCount: r.metrics.eventCount * dayShare, totalUsers: r.metrics.totalUsers * dayShare, activeUsers: 0, newUsers: 0, sessions: 0 },
    });
  }
  return out;
}

export type AggregateRow = {
  date: string;
  breakdown: AggregateBreakdown;
  eventName: string;
  dims: Partial<Record<AggregateDimension, string>>;
  dimsKey: string;
  metrics: { eventCount: number; totalUsers: number; activeUsers: number; newUsers: number; sessions: number };
};

/** Converts one report's rows. Relies on the dimension/metric order buildReportSpecs requested. */
export function toAggregateRows(spec: Pick<ReportSpec, "breakdown" | "kind">, rows: ReportRow[]): AggregateRow[] {
  const dimNames = AGGREGATE_BREAKDOWNS[spec.breakdown] as readonly AggregateDimension[];
  const leading = spec.kind === "events" ? 2 : 1; // date (+ eventName)

  return rows.map((row) => {
    const dims: Partial<Record<AggregateDimension, string>> = {};
    dimNames.forEach((name, i) => (dims[name] = row.dimensions[leading + i]));
    const m = row.metrics;
    return {
      date: fromGa4Date(row.dimensions[0]),
      breakdown: spec.breakdown,
      eventName: spec.kind === "events" ? row.dimensions[1] : ALL_EVENTS,
      dims,
      dimsKey: buildDimsKey(spec.breakdown, dims),
      metrics:
        spec.kind === "events"
          ? { eventCount: m[0], totalUsers: m[1], activeUsers: 0, newUsers: 0, sessions: 0 }
          : { totalUsers: m[0], activeUsers: m[1], newUsers: m[2], sessions: m[3], eventCount: m[4] },
    };
  });
}
