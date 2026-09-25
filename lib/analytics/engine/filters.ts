import { AGGREGATE_BREAKDOWNS, type AggregateBreakdown, type AggregateDimension } from "../constants";

// Dashboard filters and "group by" dimensions, and which stored breakdown
// can answer them. Aggregate rows only exist per breakdown family (see
// constants.ts), so a filter + grouping combination is answerable only if
// every dimension it touches lives in one family: country + city works
// (the "city" rows carry both), source + medium works ("acquisition"), but
// country + device doesn't — no stored row carries both. Such requests are
// rejected with a clear message rather than answered wrongly.

/** Public (query-string) names for each GA4 dimension. */
export const FILTER_PARAMS = {
  country: "country",
  city: "city",
  device: "deviceCategory",
  browser: "browser",
  os: "operatingSystem",
  source: "sessionSource",
  medium: "sessionMedium",
  campaign: "sessionCampaignName",
  channel: "sessionDefaultChannelGroup",
  landingPage: "landingPage",
  page: "pagePath",
} as const satisfies Record<string, AggregateDimension>;

export type FilterParam = keyof typeof FILTER_PARAMS;
export const FILTER_PARAM_NAMES = Object.keys(FILTER_PARAMS) as FilterParam[];

/** Exact-match filters, keyed by GA4 dimension. */
export type DimensionFilters = Partial<Record<AggregateDimension, string>>;

export class FilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterError";
  }
}

const MAX_FILTER_VALUE_LENGTH = 500;

/** Reads the filter params that are present. Empty values are ignored. */
export function parseFilters(params: URLSearchParams): DimensionFilters {
  const filters: DimensionFilters = {};
  for (const name of FILTER_PARAM_NAMES) {
    const value = params.get(name);
    if (value === null || value === "") continue;
    if (value.length > MAX_FILTER_VALUE_LENGTH) throw new FilterError(`The ${name} filter is too long.`);
    filters[FILTER_PARAMS[name]] = value;
  }
  return filters;
}

export function isFilterParam(value: string): value is FilterParam {
  return Object.hasOwn(FILTER_PARAMS, value);
}

const paramFor = (dim: AggregateDimension) => FILTER_PARAM_NAMES.find((p) => FILTER_PARAMS[p] === dim) ?? dim;

// Smallest family first, so "country" alone reads the country rows rather
// than summing every city.
const BREAKDOWNS_BY_SIZE = (Object.keys(AGGREGATE_BREAKDOWNS) as AggregateBreakdown[]).sort(
  (a, b) => AGGREGATE_BREAKDOWNS[a].length - AGGREGATE_BREAKDOWNS[b].length
);

/**
 * The breakdown whose rows carry every dimension in `dims` (filters plus
 * grouping). "total" when there are none. Throws FilterError when the
 * combination spans families.
 */
export function breakdownFor(dims: readonly AggregateDimension[]): AggregateBreakdown {
  const wanted = [...new Set(dims)];
  const match = BREAKDOWNS_BY_SIZE.find((b) => wanted.every((d) => (AGGREGATE_BREAKDOWNS[b] as readonly string[]).includes(d)));
  if (match) return match;
  const names = wanted.map(paramFor).join(" + ");
  throw new FilterError(
    `${names} can't be combined: analytics are stored per dimension family (location, device, browser, OS, acquisition, channel, landing page, page), and these come from different families.`
  );
}

/**
 * True when a breakdown's rows can hold several rows per (theme, date, event)
 * for this filter/grouping, i.e. daily unique users have to be *summed*
 * across rows and may count a person twice. Example: filtering acquisition
 * by source alone sums every medium/campaign row of that source.
 */
export function sumsAcrossRows(breakdown: AggregateBreakdown, pinned: readonly AggregateDimension[]): boolean {
  return AGGREGATE_BREAKDOWNS[breakdown].some((d) => !pinned.includes(d));
}

/** Mongo match on AnalyticsAggregate.dims for the filters. */
export function filterMatch(filters: DimensionFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).map(([dim, value]) => [`dims.${dim}`, value as string]));
}

/** A stable string for a filter set (cache keys). */
export function filtersKey(filters: DimensionFilters): string {
  return Object.keys(filters)
    .sort()
    .map((d) => `${d}=${filters[d as AggregateDimension]}`)
    .join("|");
}
