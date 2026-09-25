import { TRACKED_EVENTS, type AggregateDimension } from "../constants";
import { DATE_RANGE_PRESETS, DateRangeError, type DateRangePreset, type DateRangeSpec } from "./dateRanges";
import { FILTER_PARAMS, FilterError, isFilterParam, parseFilters, type DimensionFilters, type FilterParam } from "./filters";

// Query-string parsing for app/api/analytics/metrics/*. Everything the
// dashboard can ask for is validated here, so the service layer only ever
// sees well-formed input.

export class MetricsRequestError extends Error {
  constructor(
    public readonly status: 400 | 404,
    message: string
  ) {
    super(message);
    this.name = "MetricsRequestError";
  }
}

export type MetricsQuery = {
  /** "all", or one theme's id or slug. */
  theme: string;
  range: DateRangeSpec;
  compare: boolean;
  filters: DimensionFilters;
  /** Extra tracked events to report alongside the funnel events. */
  events: string[];
};

export const BREAKDOWN_SORTS = ["users", "sessions", "themeViews", "tryTheme", "installs", "tryThemeRate", "installRate"] as const;
export type BreakdownSort = (typeof BREAKDOWN_SORTS)[number];

export type BreakdownQuery = MetricsQuery & {
  dimension: FilterParam;
  groupDims: AggregateDimension[];
  sort: BreakdownSort;
  order: "asc" | "desc";
  limit: number;
  offset: number;
};

export const MAX_BREAKDOWN_LIMIT = 100;
const TRACKED = new Set<string>(TRACKED_EVENTS);

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T, name: string): T {
  if (value === null || value === "") return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new MetricsRequestError(400, `Unknown ${name} "${value}". Expected one of: ${allowed.join(", ")}.`);
}

function integer(value: string | null, fallback: number, min: number, max: number, name: string): number {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new MetricsRequestError(400, `${name} must be a whole number from ${min} to ${max}.`);
  return n;
}

export function parseMetricsQuery(params: URLSearchParams): MetricsQuery {
  const theme = params.get("theme")?.trim() || "all";
  if (theme.length > 100) throw new MetricsRequestError(400, "Invalid theme.");

  const preset = oneOf<DateRangePreset>(params.get("range"), DATE_RANGE_PRESETS, "last30", "range");
  const range: DateRangeSpec = preset === "custom" ? { preset, start: params.get("start") ?? undefined, end: params.get("end") ?? undefined } : { preset };
  if (preset === "custom" && (!range.start || !range.end)) throw new MetricsRequestError(400, "A custom range needs start and end (YYYY-MM-DD).");

  const compareParam = params.get("compare");
  if (compareParam !== null && !["previous", "none", "true", "false", ""].includes(compareParam)) {
    throw new MetricsRequestError(400, 'compare must be "previous" or "none".');
  }
  const compare = compareParam === null || compareParam === "" || compareParam === "previous" || compareParam === "true";

  const events = (params.get("events") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const unknown = events.filter((e) => !TRACKED.has(e));
  if (unknown.length) throw new MetricsRequestError(400, `Untracked event(s): ${unknown.join(", ")}. Tracked events: ${TRACKED_EVENTS.join(", ")}.`);

  let filters: DimensionFilters;
  try {
    filters = parseFilters(params);
  } catch (err) {
    throw err instanceof FilterError ? new MetricsRequestError(400, err.message) : err;
  }
  return { theme, range, compare, filters, events: [...new Set(events)] };
}

/** Grouping dims for a breakdown table: city rows are keyed by country + city (same-named cities in different countries stay apart). */
export function groupDimsFor(dimension: FilterParam): AggregateDimension[] {
  return dimension === "city" ? ["country", "city"] : [FILTER_PARAMS[dimension]];
}

export function parseBreakdownQuery(params: URLSearchParams): BreakdownQuery {
  const base = parseMetricsQuery(params);
  const dimension = params.get("dimension");
  if (!dimension || !isFilterParam(dimension)) {
    throw new MetricsRequestError(400, `dimension is required, one of: ${Object.keys(FILTER_PARAMS).join(", ")}.`);
  }
  return {
    ...base,
    dimension,
    groupDims: groupDimsFor(dimension),
    sort: oneOf(params.get("sort"), BREAKDOWN_SORTS, "users", "sort"),
    order: oneOf(params.get("order"), ["asc", "desc"] as const, "desc", "order"),
    limit: integer(params.get("limit"), 25, 1, MAX_BREAKDOWN_LIMIT, "limit"),
    offset: integer(params.get("offset"), 0, 0, 1_000_000, "offset"),
  };
}

/** DateRangeError / FilterError from deeper layers become 400s. */
export function asRequestError(err: unknown): unknown {
  if (err instanceof DateRangeError || err instanceof FilterError) return new MetricsRequestError(400, err.message);
  return err;
}
