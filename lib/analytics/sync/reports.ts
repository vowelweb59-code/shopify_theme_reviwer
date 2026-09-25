import { AGGREGATE_BREAKDOWNS, ALL_EVENTS, TRACKED_EVENTS, buildDimsKey, type AggregateBreakdown, type AggregateDimension } from "../constants";
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

export type ReportKind = "events" | "totals";

const EVENT_METRICS = ["eventCount", "totalUsers"] as const;
const TOTAL_METRICS = ["totalUsers", "activeUsers", "newUsers", "sessions", "eventCount"] as const;

export type ReportSpec = { breakdown: AggregateBreakdown; kind: ReportKind; request: ReportRequest };

export function buildReportSpecs(range: { start: string; end: string }): ReportSpec[] {
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
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [...TRACKED_EVENTS] } } },
      },
    });
    specs.push({
      breakdown,
      kind: "totals",
      request: {
        dateRanges,
        dimensions: [{ name: "date" }, ...dims.map((name) => ({ name }))],
        metrics: TOTAL_METRICS.map((name) => ({ name })),
      },
    });
  }
  return specs;
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
