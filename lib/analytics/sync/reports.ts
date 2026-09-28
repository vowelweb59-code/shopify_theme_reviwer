import { AGGREGATE_BREAKDOWNS, PRIMARY_EVENTS, TRACKED_EVENTS, buildDimsKey, type AggregateBreakdown, type AggregateDimension } from "../constants";
import { fromGa4Date } from "./dates";
import type { ReportRequest, ReportRow } from "./ga4Client";

// Which GA4 reports one sync chunk runs, and how their rows become
// AnalyticsAggregate rows: one report per breakdown, date x eventName x
// the breakdown's dimensions, for the tracked events (Try Theme and
// install) only, with their event count.
//
// A theme that shares its property with another theme has a page path
// prefix (e.g. "/themes/adorn/"), applied to every report so only its own
// pages' events count. Installs carry no page at all, so for such a theme
// they're estimated separately (installEstimateRequest below).

export type ReportSpec = { breakdown: AggregateBreakdown; request: ReportRequest };

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
  return (Object.keys(AGGREGATE_BREAKDOWNS) as AggregateBreakdown[]).map((breakdown) => {
    const dims = AGGREGATE_BREAKDOWNS[breakdown] as readonly AggregateDimension[];
    return {
      breakdown,
      request: {
        dateRanges: [{ startDate: range.start, endDate: range.end }],
        dimensions: [{ name: "date" }, { name: "eventName" }, ...dims.map((name) => ({ name }))],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: allOf({ filter: { fieldName: "eventName", inListFilter: { values: [...TRACKED_EVENTS] } } }, pageFilter),
      },
    };
  });
}

// ---- Install estimates for a theme on a shared property ----

/** date × eventName, with no page filter: the whole property's installs and Try Theme clicks. */
export function installEstimateRequest(range: { start: string; end: string }): ReportRequest {
  return {
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [...TRACKED_EVENTS] } } },
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
 * Theme share over the whole chunk (none at all: no installs). Returned
 * as `total` rows (estimates are fractional; installs have no breakdown
 * dimensions to split by, so no other breakdown gets rows).
 *
 * `themeRows` are the theme's page-filtered "total" events rows; `property`
 * is the installEstimateRequest report.
 */
export function estimateInstallRows(themeRows: readonly AggregateRow[], property: readonly ReportRow[]): AggregateRow[] {
  const theme = countsByDate(themeRows.filter((r) => r.breakdown === "total"));
  const propertyRows = property.map((row) => ({ date: fromGa4Date(row.dimensions[0]), eventName: row.dimensions[1], metrics: { eventCount: row.metrics[0] } }));
  const whole = countsByDate(propertyRows);

  const sum = (m: DailyEventCounts, event: string) => [...m.values()].reduce((n, day) => n + (day[event] ?? 0), 0);
  const share = (mine: number, all: number) => (all > 0 ? Math.min(1, mine / all) : null);
  const chunkShare = share(sum(theme, PRIMARY_EVENTS.tryTheme), sum(whole, PRIMARY_EVENTS.tryTheme)) ?? 0;

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
      metrics: { eventCount: r.metrics.eventCount * dayShare },
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
  metrics: { eventCount: number };
};

/** Converts one report's rows. Relies on the dimension/metric order buildReportSpecs requested. */
export function toAggregateRows(spec: Pick<ReportSpec, "breakdown">, rows: ReportRow[]): AggregateRow[] {
  const dimNames = AGGREGATE_BREAKDOWNS[spec.breakdown] as readonly AggregateDimension[];
  return rows.map((row) => {
    const dims: Partial<Record<AggregateDimension, string>> = {};
    dimNames.forEach((name, i) => (dims[name] = row.dimensions[2 + i])); // after date, eventName
    return {
      date: fromGa4Date(row.dimensions[0]),
      breakdown: spec.breakdown,
      eventName: row.dimensions[1],
      dims,
      dimsKey: buildDimsKey(spec.breakdown, dims),
      metrics: { eventCount: row.metrics[0] },
    };
  });
}
