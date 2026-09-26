import "server-only";
import { AnalyticsRangeUsers } from "@/models/analytics-range-users";
import type { AggregateDimension } from "../constants";
import { Ga4ConnectionError } from "../googleConnections";
import { addDays, todayInTimeZone } from "../sync/dates";
import { classifyDataApiError, type DataApi, type ReportRequest } from "../sync/ga4Client";
import { pagePathFilter } from "../sync/reports";
import { REFETCH_DAYS } from "../sync/runSync";
import type { DateRange } from "./dateRanges";
import { filtersKey, type DimensionFilters } from "./filters";
import type { UniqueUsers } from "./kpis";

// Range-level unique users, the one dashboard figure that can't come from
// the daily AnalyticsAggregate rows (§4.1 of the architecture doc). Asked
// of GA4 on demand and cached in AnalyticsRangeUsers, so a range is only
// fetched once an hour at most — and only once at all once its dates have
// settled. Two small reports per request:
//   totals: [group dims]            → users who did anything
//   events: [eventName, group dims] → users per requested event
// Never throws: any GA4 failure returns null and the caller falls back to
// summed daily users (labelled as such).

/** Groups beyond this many are left out; callers fall back to daily sums for them. */
export const GROUP_ROW_LIMIT = 5_000;
const SETTLED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export type UniqueUsersRequest = {
  themeId: string;
  propertyId: string;
  connectionId: string;
  timeZone: string | null;
  range: DateRange;
  /** Dimensions to group by ([] = one overall figure). */
  groupDims: readonly AggregateDimension[];
  filters: DimensionFilters;
  /** The theme's page filter, for a property shared with other themes. */
  pagePathPrefix?: string | null;
  events: readonly string[];
};

export type UniqueUsersResult = {
  /** Keyed by groupKey() of each group's dimension values; "" when ungrouped. */
  groups: Map<string, UniqueUsers>;
  truncated: boolean;
  warnings: string[];
};

export type UniqueUsersDeps = {
  dataApiFor: (connectionId: string) => Promise<DataApi>;
  now: () => Date;
  /** Skip the Mongo cache (tests of the GA4 side). */
  noCache?: boolean;
};

/** The same "dim=value|dim=value" shape buildDimsKey uses, over just the group dims. */
export function groupKey(groupDims: readonly AggregateDimension[], values: Partial<Record<AggregateDimension, string | null>>): string {
  return groupDims.map((d) => `${d}=${values[d] ?? ""}`).join("|");
}

export function cacheKeyFor(req: Pick<UniqueUsersRequest, "range" | "groupDims" | "filters" | "events" | "pagePathPrefix">): string {
  const parts = [`${req.range.start}..${req.range.end}`, `g=${req.groupDims.join(",")}`, `f=${filtersKey(req.filters)}`, `e=${[...req.events].sort().join(",")}`];
  // Only when set, so existing cache entries for unfiltered themes stay valid.
  if (req.pagePathPrefix) parts.push(`p=${req.pagePathPrefix}`);
  return parts.join("|");
}

/** A range is settled once its last day is older than the days GA4 still revises. */
export function isSettled(range: DateRange, timeZone: string | null, now: Date): boolean {
  return range.end < addDays(todayInTimeZone(timeZone, now), -REFETCH_DAYS);
}

function filterExpression(filters: DimensionFilters, pagePathPrefix: string | null | undefined, events: readonly string[] | null): ReportRequest["dimensionFilter"] {
  const expressions: NonNullable<ReportRequest["dimensionFilter"]>[] = Object.entries(filters).map(([fieldName, value]) => ({
    filter: { fieldName, stringFilter: { matchType: "EXACT", value: value as string } },
  }));
  if (pagePathPrefix) expressions.push(pagePathFilter(pagePathPrefix));
  if (events) expressions.push({ filter: { fieldName: "eventName", inListFilter: { values: [...events] } } });
  if (expressions.length === 0) return undefined;
  return expressions.length === 1 ? expressions[0] : { andGroup: { expressions } };
}

export function buildUniqueUsersRequests(req: Pick<UniqueUsersRequest, "range" | "groupDims" | "filters" | "events" | "pagePathPrefix">): { totals: ReportRequest; events: ReportRequest } {
  const dateRanges = [{ startDate: req.range.start, endDate: req.range.end }];
  const metrics = [{ name: "totalUsers" }];
  const orderBys = [{ metric: { metricName: "totalUsers" }, desc: true }];
  const groupDimensions = req.groupDims.map((name) => ({ name }));
  return {
    totals: {
      dateRanges,
      metrics,
      dimensions: groupDimensions,
      dimensionFilter: filterExpression(req.filters, req.pagePathPrefix, null),
      orderBys,
      limit: String(GROUP_ROW_LIMIT),
    },
    events: {
      dateRanges,
      metrics,
      dimensions: [{ name: "eventName" }, ...groupDimensions],
      dimensionFilter: filterExpression(req.filters, req.pagePathPrefix, req.events),
      orderBys,
      limit: String(GROUP_ROW_LIMIT * req.events.length),
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("GA4 request timed out"), { status: 503 })), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e))
    );
  });
}

type RawReport = { rows?: { dimensionValues?: { value?: string | null }[]; metricValues?: { value?: string | null }[] }[] | null; rowCount?: number | null; metadata?: { subjectToThresholding?: boolean | null; dataLossFromOtherRow?: boolean | null } | null };

/** Asks GA4 directly (no cache). */
export async function fetchUniqueUsers(api: DataApi, req: UniqueUsersRequest): Promise<UniqueUsersResult> {
  const requests = buildUniqueUsersRequests(req);
  const run = async (body: ReportRequest) =>
    (await withTimeout(api.properties.runReport({ property: `properties/${req.propertyId}`, requestBody: body }), REQUEST_TIMEOUT_MS)).data as RawReport;
  const [totals, events] = await Promise.all([run(requests.totals), run(requests.events)]);

  const groups = new Map<string, UniqueUsers>();
  const valuesOf = (dimensionValues: { value?: string | null }[] | undefined, offset: number) => {
    const values: Partial<Record<AggregateDimension, string>> = {};
    req.groupDims.forEach((d, i) => (values[d] = dimensionValues?.[offset + i]?.value ?? ""));
    return values;
  };
  const group = (key: string) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { users: 0, eventUsers: {} }));
    return g;
  };

  for (const row of totals.rows ?? []) {
    group(groupKey(req.groupDims, valuesOf(row.dimensionValues, 0))).users = Number(row.metricValues?.[0]?.value ?? 0) || 0;
  }
  for (const row of events.rows ?? []) {
    const eventName = row.dimensionValues?.[0]?.value ?? "";
    group(groupKey(req.groupDims, valuesOf(row.dimensionValues, 1))).eventUsers[eventName] = Number(row.metricValues?.[0]?.value ?? 0) || 0;
  }
  // An ungrouped range with no traffic still has a (zero) answer.
  if (req.groupDims.length === 0) group("");

  const warnings: string[] = [];
  if (totals.metadata?.subjectToThresholding || events.metadata?.subjectToThresholding) {
    warnings.push("GA4 applied data thresholds to unique-user counts, so small numbers may be withheld.");
  }
  if (totals.metadata?.dataLossFromOtherRow || events.metadata?.dataLossFromOtherRow) {
    warnings.push("GA4 grouped some rare values into \"(other)\" in unique-user counts.");
  }
  const truncated = (totals.rowCount ?? 0) > (totals.rows?.length ?? 0) || (events.rowCount ?? 0) > (events.rows?.length ?? 0);
  return { groups, truncated, warnings };
}

type CachedGroup = { key: string; users: number; eventUsers?: Map<string, number> | Record<string, number> };
type CachedDoc = { groups: CachedGroup[]; truncated?: boolean; warnings?: string[] };

function fromCache(doc: CachedDoc): UniqueUsersResult {
  const groups = new Map<string, UniqueUsers>();
  for (const g of doc.groups) {
    const eventUsers = g.eventUsers instanceof Map ? Object.fromEntries(g.eventUsers) : { ...(g.eventUsers ?? {}) };
    groups.set(g.key ?? "", { users: g.users, eventUsers });
  }
  return { groups, truncated: Boolean(doc.truncated), warnings: doc.warnings ?? [] };
}

/** Cached lookup. Returns null (never throws) when GA4 can't answer; the reason is logged. */
export async function getUniqueUsers(req: UniqueUsersRequest, deps: UniqueUsersDeps): Promise<UniqueUsersResult | null> {
  const cacheKey = cacheKeyFor(req);
  const identity = { analyticsThemeId: req.themeId, ga4PropertyId: req.propertyId, cacheKey };
  const now = deps.now();

  if (!deps.noCache) {
    const cached = await AnalyticsRangeUsers.findOne({ ...identity, expiresAt: { $gt: now } }).lean<CachedDoc>();
    if (cached) return fromCache(cached);
  }

  let result: UniqueUsersResult;
  try {
    result = await fetchUniqueUsers(await deps.dataApiFor(req.connectionId), req);
  } catch (err) {
    const reason = err instanceof Ga4ConnectionError ? err.code : classifyDataApiError(err).code;
    console.error(`[ga4-engine] unique users unavailable for theme ${req.themeId}:`, reason);
    return null;
  }

  if (!deps.noCache) {
    const expiresAt = new Date(now.getTime() + (isSettled(req.range, req.timeZone, now) ? SETTLED_TTL_MS : RECENT_TTL_MS));
    const groups = [...result.groups].map(([key, g]) => ({ key, users: g.users, eventUsers: g.eventUsers }));
    await AnalyticsRangeUsers.updateOne(identity, { $set: { groups, truncated: result.truncated, warnings: result.warnings, expiresAt } }, { upsert: true }).catch((err) => {
      // A failed cache write only costs a refetch next time.
      console.error("[ga4-engine] couldn't cache unique users:", err instanceof Error ? err.message : err);
    });
  }
  return result;
}
