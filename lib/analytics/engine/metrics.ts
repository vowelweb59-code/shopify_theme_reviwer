import "server-only";
import { Types } from "mongoose";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { isValidObjectId } from "@/lib/api/validation";
import { TRACKED_EVENTS, type AggregateBreakdown, type AggregateDimension } from "../constants";
import { DATE_RANGE_LABELS, daysBetween, datesInRange, rangeLength, resolvePeriod, type DateRange, type ResolvedPeriod } from "./dateRanges";
import { breakdownFor, filterMatch, type DimensionFilters } from "./filters";
import { compareKpis, computeKpis, dailySeries, sumKpis, type DailyMetrics, type DailyPoint, type KpiComparison, type KpiSet } from "./kpis";
import { MetricsRequestError, asRequestError, type BreakdownQuery, type BreakdownSort, type MetricsQuery } from "./params";

// The analytics service behind app/api/analytics/metrics/*: loads the
// cached AnalyticsAggregate rows (Try Theme and install event counts) for
// the requested themes, date range and filters, and hands them to the pure
// calculations in kpis.ts. It never calls GA4. No business maths lives in
// React or the route handlers. Callers must have run connectToDatabase().

export type EngineDeps = { now: () => Date };

export const defaultEngineDeps: EngineDeps = { now: () => new Date() };

export const RATES_NOTE =
  "Install rate is installs ÷ Try Theme clicks in the same period. It compares totals, not people (GA4's aggregate data doesn't follow anyone from a click to an install), so it can exceed 100%.";

// ---- Theme context ----

function installsEstimatedWarning(names: string[]): string {
  const list = names.join(", ");
  return `Installs for ${list} are estimated. ${names.length === 1 ? "Its" : "Their"} GA4 property also tracks another theme, and install events carry no page, so each day's installs are split by that day's share of Try Theme clicks. Breakdowns (country, device, …) can't include these installs.`;
}

type ThemeLean = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ga4PropertyId?: string | null;
  ga4PropertyTimeZone?: string | null;
  pagePathPrefix?: string | null;
  syncedThroughDate?: string | null;
  lastSuccessfulSyncAt?: Date | null;
};

export type ThemeContext = {
  id: string;
  name: string;
  slug: string;
  propertyId: string;
  timeZone: string | null;
  /** Set when the theme shares its GA4 property: only its pages count, and its installs are estimated. */
  pagePathPrefix: string | null;
  syncedThroughDate: string | null;
  lastSuccessfulSyncAt: string | null;
  period: ResolvedPeriod;
};

export type PublicThemeRef = { id: string; name: string; slug: string };

export type MetricsMeta = {
  scope: "all" | "theme";
  theme: PublicThemeRef | null;
  themes: (PublicThemeRef & {
    timeZone: string | null;
    syncedThroughDate: string | null;
    lastSuccessfulSyncAt: string | null;
    /** Installs are an estimate (the theme shares its GA4 property; installs carry no page). */
    installsEstimated: boolean;
    current: DateRange;
    previous: DateRange | null;
  })[];
  range: { preset: string; label: string; current: DateRange; previous: DateRange | null; timeZone: string | null };
  /** Themes in different time zones resolve presets like "Today" to different dates. */
  mixedTimeZones: boolean;
  filters: DimensionFilters;
  breakdown: AggregateBreakdown;
  warnings: string[];
  notes: string[];
};

type Context = {
  query: MetricsQuery;
  scope: "all" | "theme";
  selected: PublicThemeRef | null;
  themes: ThemeContext[];
  warnings: string[];
};

async function loadContext(query: MetricsQuery, deps: EngineDeps): Promise<Context> {
  const fields = "name slug ga4PropertyId ga4PropertyTimeZone pagePathPrefix syncedThroughDate lastSuccessfulSyncAt";
  let docs: ThemeLean[];
  let selected: PublicThemeRef | null = null;
  const warnings: string[] = [];

  if (query.theme === "all") {
    docs = await AnalyticsTheme.find({ isActive: true, ga4PropertyId: { $type: "string" } }).select(fields).sort({ name: 1 }).lean<ThemeLean[]>();
    if (docs.length === 0) warnings.push("No themes are mapped to a GA4 property yet.");
  } else {
    const filter = isValidObjectId(query.theme) ? { _id: query.theme } : { slug: query.theme.toLowerCase() };
    const doc = await AnalyticsTheme.findOne(filter).select(fields).lean<ThemeLean>();
    if (!doc) throw new MetricsRequestError(404, "Theme not found.");
    selected = { id: doc._id.toString(), name: doc.name, slug: doc.slug };
    docs = doc.ga4PropertyId ? [doc] : [];
    if (!doc.ga4PropertyId) warnings.push(`${doc.name} isn't mapped to a GA4 property yet.`);
  }

  const now = deps.now();
  let themes: ThemeContext[];
  try {
    themes = docs.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      slug: d.slug,
      propertyId: d.ga4PropertyId as string,
      timeZone: d.ga4PropertyTimeZone ?? null,
      pagePathPrefix: d.pagePathPrefix ?? null,
      syncedThroughDate: d.syncedThroughDate ?? null,
      lastSuccessfulSyncAt: d.lastSuccessfulSyncAt ? new Date(d.lastSuccessfulSyncAt).toISOString() : null,
      period: resolvePeriod(query.range, d.ga4PropertyTimeZone, query.compare, now),
    }));
    // Validates a custom range even when there are no themes to resolve it for.
    if (themes.length === 0) resolvePeriod(query.range, "UTC", query.compare, now);
  } catch (err) {
    throw asRequestError(err);
  }

  const unsynced = themes.filter((t) => !t.syncedThroughDate).map((t) => t.name);
  if (unsynced.length) warnings.push(`${unsynced.join(", ")} ${unsynced.length === 1 ? "hasn't" : "haven't"} finished a first GA4 sync, so data may be missing.`);
  const estimated = themes.filter((t) => t.pagePathPrefix).map((t) => t.name);
  if (estimated.length) warnings.push(installsEstimatedWarning(estimated));
  return { query, scope: query.theme === "all" ? "all" : "theme", selected, themes, warnings };
}

function buildMeta(ctx: Context, breakdown: AggregateBreakdown, now: Date): MetricsMeta {
  const reference = ctx.themes[0];
  const period = reference?.period ?? resolvePeriod(ctx.query.range, "UTC", ctx.query.compare, now);
  return {
    scope: ctx.scope,
    theme: ctx.selected,
    themes: ctx.themes.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      timeZone: t.timeZone,
      syncedThroughDate: t.syncedThroughDate,
      lastSuccessfulSyncAt: t.lastSuccessfulSyncAt,
      installsEstimated: Boolean(t.pagePathPrefix),
      current: t.period.current,
      previous: t.period.previous,
    })),
    range: { preset: ctx.query.range.preset, label: DATE_RANGE_LABELS[ctx.query.range.preset], current: period.current, previous: period.previous, timeZone: reference?.timeZone ?? "UTC" },
    mixedTimeZones: new Set(ctx.themes.map((t) => t.timeZone ?? "UTC")).size > 1,
    filters: ctx.query.filters,
    breakdown,
    warnings: ctx.warnings,
    notes: [RATES_NOTE],
  };
}

function breakdownOrThrow(dims: AggregateDimension[]): AggregateBreakdown {
  try {
    return breakdownFor(dims);
  } catch (err) {
    throw asRequestError(err);
  }
}

// ---- Loading rows ----

type GroupedPoint = DailyPoint & { group: string };

/** "dim=value|..." — the same shape buildDimsKey uses, over just the grouped dims. */
export function groupKey(groupDims: readonly AggregateDimension[], values: Partial<Record<AggregateDimension, string | null>>): string {
  return groupDims.map((d) => `${d}=${values[d] ?? ""}`).join("|");
}

/**
 * Sums matching aggregate rows per theme × date × event (× group), for the
 * current and previous ranges at once.
 *
 * `granularity: "period"` collapses each row's date to its period's start
 * date inside MongoDB, so a year of page-level rows comes back as one
 * point per theme × period × event × page instead of one per day.
 * Everything except trends only sums over whole periods, so the result is
 * identical; points keep a date in their period, so callers' inRange()
 * checks still work.
 */
async function loadPoints(
  themes: ThemeContext[],
  breakdown: AggregateBreakdown,
  filters: DimensionFilters,
  groupDims: readonly AggregateDimension[] = [],
  granularity: "day" | "period" = "period"
): Promise<GroupedPoint[]> {
  if (themes.length === 0) return [];
  const match = {
    breakdown,
    eventName: { $in: [...TRACKED_EVENTS] },
    ...filterMatch(filters),
    // Also pinned to the theme's *current* property: a remapped theme's old
    // rows are purged by its next sync, but must never mix in before that.
    $or: themes.map((t) => ({
      analyticsThemeId: new Types.ObjectId(t.id),
      ga4PropertyId: t.propertyId,
      date: { $gte: (t.period.previous ?? t.period.current).start, $lte: t.period.current.end },
    })),
  };
  // A row is in its theme's current range if its date is ≥ that range's
  // start (the $match already bounds both ends); otherwise it's previous.
  const periodStart = {
    $switch: {
      branches: themes.map((t) => ({
        case: { $and: [{ $eq: ["$analyticsThemeId", new Types.ObjectId(t.id)] }, { $gte: ["$date", t.period.current.start] }] },
        then: t.period.current.start,
      })),
      // Only previous-period rows reach the default; bucket each at its own theme's previous start.
      default: {
        $switch: {
          branches: themes.map((t) => ({ case: { $eq: ["$analyticsThemeId", new Types.ObjectId(t.id)] }, then: (t.period.previous ?? t.period.current).start })),
          default: "$date",
        },
      },
    },
  };
  const groupId: Record<string, unknown> = { t: "$analyticsThemeId", d: granularity === "day" ? "$date" : periodStart, e: "$eventName" };
  for (const d of groupDims) groupId[`g_${d}`] = `$dims.${d}`;

  const rows = await AnalyticsAggregate.aggregate<{ _id: Record<string, unknown> & { t: Types.ObjectId; d: string; e: string }; eventCount: number }>([
    { $match: match },
    { $group: { _id: groupId, eventCount: { $sum: "$metrics.eventCount" } } },
  ])
    .allowDiskUse(true)
    // A runaway query fails with a 500 instead of tying up the database indefinitely.
    .option({ maxTimeMS: 30_000 });

  return rows.map((r) => {
    const values: Partial<Record<AggregateDimension, string | null>> = {};
    for (const d of groupDims) values[d] = (r._id[`g_${d}`] as string | null | undefined) ?? null;
    return { themeId: r._id.t.toString(), date: r._id.d, eventName: r._id.e, eventCount: r.eventCount, group: groupKey(groupDims, values) };
  });
}

const inRange = (range: DateRange) => (p: DailyPoint) => p.date >= range.start && p.date <= range.end;

// ---- Overview + theme comparison ----

export type PeriodKpis = { current: KpiSet; previous: KpiSet | null; comparison: KpiComparison | null };

export type ThemeKpiRow = PeriodKpis & { theme: PublicThemeRef };

type KpiWork = { ctx: Context; breakdown: AggregateBreakdown; perTheme: ThemeKpiRow[] };

async function computePerThemeKpis(query: MetricsQuery, deps: EngineDeps): Promise<KpiWork> {
  const ctx = await loadContext(query, deps);
  const breakdown = breakdownOrThrow(Object.keys(query.filters) as AggregateDimension[]);
  const points = await loadPoints(ctx.themes, breakdown, query.filters);
  const perTheme = ctx.themes.map((t) => {
    const mine = points.filter((p) => p.themeId === t.id);
    const current = computeKpis(mine.filter(inRange(t.period.current)));
    const previous = t.period.previous ? computeKpis(mine.filter(inRange(t.period.previous))) : null;
    return { theme: { id: t.id, name: t.name, slug: t.slug }, current, previous, comparison: previous ? compareKpis(current, previous) : null };
  });
  return { ctx, breakdown, perTheme };
}

function totalOf(rows: ThemeKpiRow[], compare: boolean): PeriodKpis {
  const current = sumKpis(rows.map((r) => r.current));
  const previous = compare ? sumKpis(rows.map((r) => r.previous).filter((p): p is KpiSet => p !== null)) : null;
  return { current, previous, comparison: previous ? compareKpis(current, previous) : null };
}

export type OverviewResponse = PeriodKpis & { meta: MetricsMeta };

/** Headline KPIs for All Themes or one theme, with the previous period. */
export async function getOverview(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<OverviewResponse> {
  const work = await computePerThemeKpis(query, deps);
  return { meta: buildMeta(work.ctx, work.breakdown, deps.now()), ...totalOf(work.perTheme, query.compare) };
}

export type ThemeComparisonResponse = { meta: MetricsMeta; themes: ThemeKpiRow[]; total: PeriodKpis };

/** One KPI row per theme (Try Theme, installs, install rate) plus the All Themes total. */
export async function getThemeComparison(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<ThemeComparisonResponse> {
  const work = await computePerThemeKpis(query, deps);
  return { meta: buildMeta(work.ctx, work.breakdown, deps.now()), themes: work.perTheme, total: totalOf(work.perTheme, query.compare) };
}

// ---- Trends ----

export type TrendsResponse = {
  meta: MetricsMeta;
  /** The reference time zone's dates; index i of `current` is day i of every theme's range. */
  dates: string[];
  previousDates: string[] | null;
  current: DailyMetrics[];
  previous: DailyMetrics[] | null;
};

/** Daily Try Theme clicks and installs, with the previous period aligned day by day for overlaying. */
export async function getTrends(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<TrendsResponse> {
  const ctx = await loadContext(query, deps);
  const breakdown = breakdownOrThrow(Object.keys(query.filters) as AggregateDimension[]);
  const points = await loadPoints(ctx.themes, breakdown, query.filters, [], "day");
  const byTheme = new Map(ctx.themes.map((t) => [t.id, t]));
  const now = deps.now();
  const reference = ctx.themes[0]?.period ?? resolvePeriod(query.range, "UTC", query.compare, now);
  const length = rangeLength(reference.current);

  // Each theme's day i is i days after *its own* range start, so themes
  // whose property-local "today" differs still line up.
  const indexIn = (which: "current" | "previous") => (p: DailyPoint) => {
    const range = byTheme.get(p.themeId)?.period[which];
    return range && p.date >= range.start && p.date <= range.end ? daysBetween(range.start, p.date) : -1;
  };

  return {
    meta: buildMeta(ctx, breakdown, now),
    dates: datesInRange(reference.current),
    previousDates: reference.previous ? datesInRange(reference.previous) : null,
    current: dailySeries(points, length, indexIn("current")),
    previous: reference.previous ? dailySeries(points, length, indexIn("previous")) : null,
  };
}

// ---- Breakdown tables (country, device, source, page, ...) ----

export type BreakdownRow = PeriodKpis & { key: string; values: Partial<Record<AggregateDimension, string | null>> };

export type BreakdownResponse = {
  meta: MetricsMeta;
  dimension: string;
  sort: BreakdownSort;
  order: "asc" | "desc";
  rows: BreakdownRow[];
  totalRows: number;
  limit: number;
  offset: number;
};

function parseKey(key: string): Partial<Record<AggregateDimension, string | null>> {
  const values: Partial<Record<AggregateDimension, string | null>> = {};
  for (const part of key.split("|")) {
    const i = part.indexOf("=");
    values[part.slice(0, i) as AggregateDimension] = part.slice(i + 1) || null;
  }
  return values;
}

const sortValue = (k: KpiSet, sort: BreakdownSort): number => (sort === "installRate" ? (k.installRate ?? -1) : k[sort]);

/**
 * KPIs per value of one dimension (e.g. per country), within the request's
 * filters, sorted and paginated server-side so the browser never gets the
 * whole long tail. Filters and the grouped dimension must share a family
 * (see filters.ts).
 */
export async function getBreakdown(query: BreakdownQuery, deps: EngineDeps = defaultEngineDeps): Promise<BreakdownResponse> {
  const ctx = await loadContext(query, deps);
  const breakdown = breakdownOrThrow([...(Object.keys(query.filters) as AggregateDimension[]), ...query.groupDims]);
  const points = await loadPoints(ctx.themes, breakdown, query.filters, query.groupDims);

  const perGroup = new Map<string, { current: KpiSet[]; previous: KpiSet[] }>();
  for (const t of ctx.themes) {
    const mine = points.filter((p) => p.themeId === t.id);
    for (const g of new Set(mine.map((p) => p.group))) {
      const slot = perGroup.get(g) ?? { current: [], previous: [] };
      perGroup.set(g, slot);
      const pts = mine.filter((p) => p.group === g);
      slot.current.push(computeKpis(pts.filter(inRange(t.period.current))));
      if (t.period.previous) slot.previous.push(computeKpis(pts.filter(inRange(t.period.previous))));
    }
  }

  const all: BreakdownRow[] = [...perGroup].map(([key, slot]) => {
    const current = sumKpis(slot.current);
    const previous = query.compare ? sumKpis(slot.previous) : null;
    return { key, values: parseKey(key), current, previous, comparison: previous ? compareKpis(current, previous) : null };
  });
  // Rows with no activity in the current range only matter for comparison; keep them, sorted last.
  const dir = query.order === "asc" ? 1 : -1;
  all.sort((a, b) => dir * (sortValue(a.current, query.sort) - sortValue(b.current, query.sort)) || a.key.localeCompare(b.key));

  return {
    meta: buildMeta(ctx, breakdown, deps.now()),
    dimension: query.dimension,
    sort: query.sort,
    order: query.order,
    rows: all.slice(query.offset, query.offset + query.limit),
    totalRows: all.length,
    limit: query.limit,
    offset: query.offset,
  };
}
