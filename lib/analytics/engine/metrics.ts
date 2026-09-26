import "server-only";
import { Types } from "mongoose";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { isValidObjectId } from "@/lib/api/validation";
import { ALL_EVENTS, PRIMARY_EVENTS, SUPPORTING_EVENTS, THEME_VIEW_EVENT, TRACKED_EVENTS, type AggregateBreakdown, type AggregateDimension } from "../constants";
import { getAuthorizedClient } from "../googleConnections";
import { createDataApi } from "../sync/ga4Client";
import { DATE_RANGE_LABELS, daysBetween, datesInRange, rangeLength, resolvePeriod, type DateRange, type ResolvedPeriod } from "./dateRanges";
import { breakdownFor, filterMatch, sumsAcrossRows, type DimensionFilters } from "./filters";
import {
  JOURNEY_EVENTS,
  compareKpis,
  computeKpis,
  journeySteps,
  dailySeries,
  sumKpis,
  withFunnelEvents,
  compareValues,
  type Change,
  type DailyMetrics,
  type DailyPoint,
  type JourneyStep,
  type KpiComparison,
  type KpiSet,
  type UniqueUsers,
  type UsersBasis,
} from "./kpis";
import { MetricsRequestError, asRequestError, type BreakdownQuery, type BreakdownSort, type MetricsQuery } from "./params";
import { getUniqueUsers, groupKey, type UniqueUsersDeps, type UniqueUsersResult } from "./uniqueUsers";

// The analytics service behind app/api/analytics/metrics/*: loads the
// cached AnalyticsAggregate rows for the requested themes, date range and
// filters, adds range-level unique users from GA4 where it can, and hands
// everything to the pure calculations in kpis.ts. No business maths lives
// in React or the route handlers. Callers must have run connectToDatabase().

export type EngineDeps = UniqueUsersDeps & {
  /** Ask GA4 for range-level unique users. Defaults to on unless ANALYTICS_UNIQUE_USERS_DISABLED=1. */
  uniqueUsers?: boolean;
};

export const defaultEngineDeps: EngineDeps = {
  dataApiFor: async (id) => createDataApi(await getAuthorizedClient(id)),
  now: () => new Date(),
};

const uniqueUsersEnabled = (deps: EngineDeps) => deps.uniqueUsers ?? process.env.ANALYTICS_UNIQUE_USERS_DISABLED !== "1";

/** GA4 requests in flight at once when filling unique users for many themes. */
const UNIQUE_USERS_CONCURRENCY = 4;

export const RATES_NOTE =
  "Conversion rates divide one event's users by another's over the same period. They are not step-by-step journeys (the same people aren't followed from one event to the next), so a rate can exceed 100%.";
export const JOURNEY_NOTE =
  "Each journey step counts the users who fired that event in the period, independently. GA4's aggregate data doesn't follow individual people from step to step, so this isn't a sequence: someone can count as a Theme View without a Page View, and a later step can be larger than an earlier one.";
const ALL_THEMES_USERS_NOTE =
  "All Themes users are the sum of each theme's users. Each theme is a separate GA4 property with no shared user id, so a person who visited two themes counts twice.";

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
  googleConnectionId?: Types.ObjectId | null;
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
  connectionId: string | null;
  connectionActive: boolean;
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
  usersBasis: UsersBasis;
  usersScope: "theme" | "sum_of_themes";
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
  const fields = "name slug ga4PropertyId ga4PropertyTimeZone pagePathPrefix googleConnectionId syncedThroughDate lastSuccessfulSyncAt";
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

  const connectionIds = [...new Set(docs.map((d) => d.googleConnectionId?.toString()).filter((id): id is string => Boolean(id)))];
  const active = new Set(
    (await GoogleConnection.find({ _id: { $in: connectionIds }, status: "active" }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map((c) => c._id.toString())
  );

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
      connectionId: d.googleConnectionId?.toString() ?? null,
      connectionActive: Boolean(d.googleConnectionId && active.has(d.googleConnectionId.toString())),
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

function buildMeta(ctx: Context, breakdown: AggregateBreakdown, usersBasis: UsersBasis, extraWarnings: string[], now: Date): MetricsMeta {
  const reference = ctx.themes[0];
  const period = reference?.period ?? resolvePeriod(ctx.query.range, "UTC", ctx.query.compare, now);
  const warnings = [...new Set([...ctx.warnings, ...extraWarnings])];
  const notes = [RATES_NOTE];
  if (ctx.scope === "all") notes.push(ALL_THEMES_USERS_NOTE);
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
    usersBasis,
    usersScope: ctx.scope === "all" ? "sum_of_themes" : "theme",
    warnings,
    notes,
  };
}

// ---- Loading rows ----

type GroupedPoint = DailyPoint & { group: string };

/**
 * Sums matching aggregate rows per theme × date × event (× group), for the
 * current and previous ranges at once.
 *
 * `granularity: "period"` collapses each row's date to its period's start
 * date inside MongoDB, so a year of page-level rows comes back as one
 * point per theme × period × event × page instead of one per day (438k →
 * 2.4k groups in the Phase 8 measurement, and inside $group's memory
 * limit). Everything except trends only sums over whole periods, so the
 * result is identical; points keep a date in their period, so callers'
 * inRange() checks still work.
 */
async function loadPoints(
  themes: ThemeContext[],
  breakdown: AggregateBreakdown,
  filters: DimensionFilters,
  events: readonly string[],
  groupDims: readonly AggregateDimension[] = [],
  granularity: "day" | "period" = "period"
): Promise<GroupedPoint[]> {
  if (themes.length === 0) return [];
  const match = {
    breakdown,
    eventName: { $in: [ALL_EVENTS, ...events] },
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

  // allowDiskUse: a safety net for very wide day-level trend queries; the
  // period-level shape above stays far below $group's in-memory limit.
  const rows = await AnalyticsAggregate.aggregate<{
    _id: Record<string, unknown> & { t: Types.ObjectId; d: string; e: string };
    eventCount: number;
    users: number;
    sessions: number;
    newUsers: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: groupId,
        eventCount: { $sum: "$metrics.eventCount" },
        users: { $sum: "$metrics.totalUsers" },
        sessions: { $sum: "$metrics.sessions" },
        newUsers: { $sum: "$metrics.newUsers" },
      },
    },
  ]).allowDiskUse(true)
    // A runaway query (very wide range × page-level rows under load) fails
    // with a 500 instead of tying up the database indefinitely.
    .option({ maxTimeMS: 30_000 });

  return rows.map((r) => {
    const values: Partial<Record<AggregateDimension, string | null>> = {};
    for (const d of groupDims) values[d] = (r._id[`g_${d}`] as string | null | undefined) ?? null;
    return {
      themeId: r._id.t.toString(),
      date: r._id.d,
      eventName: r._id.e,
      eventCount: r.eventCount,
      users: r.users,
      sessions: r.sessions,
      newUsers: r.newUsers,
      group: groupKey(groupDims, values),
    };
  });
}

const inRange = (range: DateRange) => (p: DailyPoint) => p.date >= range.start && p.date <= range.end;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// Process-wide cap on concurrent unique-user lookups (each is 2 GA4
// requests), across all dashboard requests, so a burst of page loads can't
// stampede GA4 and eat the quota the background sync needs.
const MAX_GA4_LOOKUPS_IN_FLIGHT = 6;
let ga4InFlight = 0;
const ga4Waiters: (() => void)[] = [];

async function withGa4Slot<T>(fn: () => Promise<T>): Promise<T> {
  if (ga4InFlight >= MAX_GA4_LOOKUPS_IN_FLIGHT) await new Promise<void>((resolve) => ga4Waiters.push(resolve));
  ga4InFlight++;
  try {
    return await fn();
  } finally {
    ga4InFlight--;
    ga4Waiters.shift()?.();
  }
}

/** Whether any loaded point for a theme falls in a range. */
function pointIndex(points: readonly DailyPoint[]): (themeId: string, range: DateRange) => boolean {
  return (themeId, range) => points.some((p) => p.themeId === themeId && p.date >= range.start && p.date <= range.end);
}

type UniqueByTheme = Map<string, { current: UniqueUsersResult | null; previous: UniqueUsersResult | null }>;

/** Range-level unique users for every theme and period. Missing entries (null) mean "fall back to daily sums". */
async function loadUniqueUsers(
  ctx: Context,
  groupDims: readonly AggregateDimension[],
  events: readonly string[],
  deps: EngineDeps,
  warnings: string[],
  hasPoints: (themeId: string, range: DateRange) => boolean
): Promise<UniqueByTheme> {
  const result: UniqueByTheme = new Map(ctx.themes.map((t) => [t.id, { current: null, previous: null }]));
  if (!uniqueUsersEnabled(deps)) return result;

  const jobs = ctx.themes.flatMap((t) =>
    (["current", "previous"] as const).flatMap((which) => {
      const range = t.period[which];
      if (!range || !t.connectionActive || !t.connectionId) return [];
      // Nothing stored for this theme/period under these filters means GA4
      // has nothing either (the sync stores every value GA4 reports), so
      // don't spend its quota asking. This also stops arbitrary filter
      // values (?page=/x1, /x2, ...) from each costing live GA4 calls.
      if (!hasPoints(t.id, range)) return [];
      return [{ theme: t, which, range, connectionId: t.connectionId }];
    })
  );
  await mapLimit(jobs, UNIQUE_USERS_CONCURRENCY, async (job) => {
    // A page-filtered theme's installs are stored estimates; GA4 can't count
    // their users (installs have no page), so they keep the estimated figure.
    const asked = job.theme.pagePathPrefix ? events.filter((e) => e !== PRIMARY_EVENTS.themeInstall) : events;
    const res = await withGa4Slot(() => getUniqueUsers(
      {
        themeId: job.theme.id,
        propertyId: job.theme.propertyId,
        connectionId: job.connectionId,
        timeZone: job.theme.timeZone,
        range: job.range,
        groupDims,
        filters: ctx.query.filters,
        pagePathPrefix: job.theme.pagePathPrefix,
        events: asked,
      },
      deps
    ));
    if (res && asked.length < events.length) {
      const estimated = events.filter((e) => !asked.includes(e));
      for (const group of res.groups.values()) group.estimated = estimated;
    }
    result.get(job.theme.id)![job.which] = res;
    if (res) warnings.push(...res.warnings);
  });
  return result;
}

/**
 * One group's unique users from a GA4 answer. A group GA4 didn't return had
 * no users in that range — unless the answer hit its row limit, in which
 * case it's unknown and the caller falls back to daily sums.
 */
export function uniqueFor(result: UniqueUsersResult | null, key: string): UniqueUsers | null {
  if (!result) return null;
  return result.groups.get(key) ?? (result.truncated ? null : { users: 0, eventUsers: {} });
}

function fallbackWarning(names: string[], breakdown: AggregateBreakdown, pinned: readonly AggregateDimension[]): string[] {
  const out: string[] = [];
  if (names.length) {
    out.push(
      `Users for ${names.join(", ")} are daily unique users added up (GA4 couldn't be asked for range-level counts), so people who came back on several days are counted once per day.`
    );
  }
  if (names.length && sumsAcrossRows(breakdown, pinned)) {
    out.push("With this filter or grouping, the fallback user figures also add up several stored rows per day, which can count the same person more than once.");
  }
  return out;
}

// ---- Overview + theme comparison ----

export type PeriodKpis = { current: KpiSet; previous: KpiSet | null; comparison: KpiComparison | null };

export type ThemeKpiRow = PeriodKpis & { theme: PublicThemeRef };

type KpiWork = { ctx: Context; breakdown: AggregateBreakdown; events: string[]; perTheme: ThemeKpiRow[]; warnings: string[] };

async function computePerThemeKpis(query: MetricsQuery, deps: EngineDeps): Promise<KpiWork> {
  const ctx = await loadContext(query, deps);
  const pinned = Object.keys(query.filters) as AggregateDimension[];
  let breakdown: AggregateBreakdown;
  try {
    breakdown = breakdownFor(pinned);
  } catch (err) {
    throw asRequestError(err);
  }
  const events = withFunnelEvents(query.events);
  const warnings: string[] = [];

  const points = await loadPoints(ctx.themes, breakdown, query.filters, events);
  const unique = await loadUniqueUsers(ctx, [], events, deps, warnings, pointIndex(points));
  const fellBack = new Set<string>();

  const perTheme = ctx.themes.map((t) => {
    const mine = points.filter((p) => p.themeId === t.id);
    const u = unique.get(t.id)!;
    const current = computeKpis(mine.filter(inRange(t.period.current)), events, uniqueFor(u.current, ""));
    const previous = t.period.previous ? computeKpis(mine.filter(inRange(t.period.previous)), events, uniqueFor(u.previous, "")) : null;
    if (current.usersBasis === "daily_sum" || previous?.usersBasis === "daily_sum") fellBack.add(t.name);
    return { theme: { id: t.id, name: t.name, slug: t.slug }, current, previous, comparison: previous ? compareKpis(current, previous) : null };
  });

  warnings.push(...fallbackWarning([...fellBack], breakdown, pinned));
  return { ctx, breakdown, events, perTheme, warnings };
}

function totalOf(rows: ThemeKpiRow[], events: string[], compare: boolean): PeriodKpis {
  const current = sumKpis(
    rows.map((r) => r.current),
    events
  );
  const previous = compare
    ? sumKpis(
        rows.map((r) => r.previous).filter((p): p is KpiSet => p !== null),
        events
      )
    : null;
  return { current, previous, comparison: previous ? compareKpis(current, previous) : null };
}

const basisOf = (...sets: (KpiSet | null)[]): UsersBasis => (sets.every((s) => !s || s.usersBasis === "unique") ? "unique" : "daily_sum");

export type OverviewResponse = PeriodKpis & { meta: MetricsMeta };

/** Headline KPIs + rates for All Themes or one theme, with the previous period. */
export async function getOverview(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<OverviewResponse> {
  const work = await computePerThemeKpis(query, deps);
  const total = totalOf(work.perTheme, work.events, query.compare);
  // With zero themes sumKpis reports "daily_sum"; there's nothing summed, so call it unique.
  const basis = work.perTheme.length ? basisOf(total.current, total.previous) : "unique";
  return { meta: buildMeta(work.ctx, work.breakdown, basis, work.warnings, deps.now()), ...total };
}

export type ThemeComparisonResponse = { meta: MetricsMeta; themes: ThemeKpiRow[]; total: PeriodKpis };

/** One KPI row per theme (users, views, Try Theme, installs, rates) plus the All Themes total. */
export async function getThemeComparison(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<ThemeComparisonResponse> {
  const work = await computePerThemeKpis(query, deps);
  const total = totalOf(work.perTheme, work.events, query.compare);
  const basis = work.perTheme.length ? basisOf(...work.perTheme.flatMap((r) => [r.current, r.previous])) : "unique";
  return { meta: buildMeta(work.ctx, work.breakdown, basis, work.warnings, deps.now()), themes: work.perTheme, total };
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

/**
 * Daily users, sessions, Theme Views, Try Theme and installs. Daily users
 * are exact per theme (they're GA4's per-day unique count); All Themes adds
 * the themes' daily users together. The previous period is aligned day by
 * day for overlaying.
 */
export async function getTrends(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<TrendsResponse> {
  const ctx = await loadContext(query, deps);
  const pinned = Object.keys(query.filters) as AggregateDimension[];
  let breakdown: AggregateBreakdown;
  try {
    breakdown = breakdownFor(pinned);
  } catch (err) {
    throw asRequestError(err);
  }
  const points = await loadPoints(ctx.themes, breakdown, query.filters, withFunnelEvents([]), [], "day");
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

  const warnings = sumsAcrossRows(breakdown, pinned) ? ["With this filter, daily users add up several stored rows per day, which can count the same person more than once."] : [];
  return {
    meta: buildMeta(ctx, breakdown, "daily_sum", warnings, now),
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

function sortValue(k: KpiSet, sort: BreakdownSort): number {
  switch (sort) {
    case "users":
      return k.users;
    case "sessions":
      return k.sessions;
    case "themeViews":
      return k.themeViews.users;
    case "tryTheme":
      return k.tryTheme.users;
    case "installs":
      return k.installs.users;
    case "tryThemeRate":
      return k.rates.tryThemeRate ?? -1;
    case "installRate":
      return k.rates.installRate ?? -1;
  }
}

/**
 * KPIs per value of one dimension (e.g. per country), within the request's
 * filters, sorted and paginated server-side so the browser never gets the
 * whole long tail. Filters and the grouped dimension must share a family
 * (see filters.ts).
 */
export async function getBreakdown(query: BreakdownQuery, deps: EngineDeps = defaultEngineDeps): Promise<BreakdownResponse> {
  const ctx = await loadContext(query, deps);
  const pinned = [...(Object.keys(query.filters) as AggregateDimension[]), ...query.groupDims];
  let breakdown: AggregateBreakdown;
  try {
    breakdown = breakdownFor(pinned);
  } catch (err) {
    throw asRequestError(err);
  }
  const events = withFunnelEvents(query.events);
  const warnings: string[] = [];
  const points = await loadPoints(ctx.themes, breakdown, query.filters, events, query.groupDims);
  const unique = await loadUniqueUsers(ctx, query.groupDims, events, deps, warnings, pointIndex(points));

  const fellBack = new Set<string>();
  const perGroup = new Map<string, { current: KpiSet[]; previous: KpiSet[] }>();
  for (const t of ctx.themes) {
    const mine = points.filter((p) => p.themeId === t.id);
    const groups = new Set(mine.map((p) => p.group));
    const u = unique.get(t.id)!;
    for (const g of groups) {
      const slot = perGroup.get(g) ?? { current: [], previous: [] };
      perGroup.set(g, slot);
      const pts = mine.filter((p) => p.group === g);
      const cur = computeKpis(pts.filter(inRange(t.period.current)), events, uniqueFor(u.current, g));
      slot.current.push(cur);
      if (cur.usersBasis === "daily_sum") fellBack.add(t.name);
      if (t.period.previous) {
        const prev = computeKpis(pts.filter(inRange(t.period.previous)), events, uniqueFor(u.previous, g));
        slot.previous.push(prev);
        if (prev.usersBasis === "daily_sum") fellBack.add(t.name);
      }
    }
  }
  const truncated = [...unique.values()].some((u) => u.current?.truncated || u.previous?.truncated);
  if (truncated) warnings.push("Some rarely-seen values fell outside GA4's unique-user row limit; their users are daily sums.");
  warnings.push(...fallbackWarning([...fellBack], breakdown, pinned));

  const all: BreakdownRow[] = [...perGroup].map(([key, slot]) => {
    const current = sumKpis(slot.current, events);
    const previous = query.compare ? sumKpis(slot.previous, events) : null;
    return { key, values: parseKey(key), current, previous, comparison: previous ? compareKpis(current, previous) : null };
  });
  // Rows with no activity in the current range only matter for comparison; keep them, sorted last.
  const dir = query.order === "asc" ? 1 : -1;
  all.sort((a, b) => dir * (sortValue(a.current, query.sort) - sortValue(b.current, query.sort)) || a.key.localeCompare(b.key));

  const basis = all.length ? basisOf(...all.flatMap((r) => [r.current, r.previous])) : "unique";
  return {
    meta: buildMeta(ctx, breakdown, basis, warnings, deps.now()),
    dimension: query.dimension,
    sort: query.sort,
    order: query.order,
    rows: all.slice(query.offset, query.offset + query.limit),
    totalRows: all.length,
    limit: query.limit,
    offset: query.offset,
  };
}

// ---- Event summary ----

export type EventRole = "primary" | "funnel" | "supporting";

export type EventSummaryRow = {
  eventName: string;
  role: EventRole;
  count: Change;
  users: Change;
};

export type EventSummaryResponse = { meta: MetricsMeta; events: EventSummaryRow[] };

function roleOf(eventName: string): EventRole {
  if (eventName === PRIMARY_EVENTS.themeInstall || eventName === PRIMARY_EVENTS.tryTheme) return "primary";
  if (eventName === THEME_VIEW_EVENT) return "funnel";
  return "supporting";
}

/**
 * Every tracked event's count and users, primary events first. Supporting
 * events are reported for context but ordered after the primary ones so
 * generic activity (page_view, scroll) never leads.
 */
export async function getEventSummary(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<EventSummaryResponse> {
  const work = await computePerThemeKpis({ ...query, events: [...TRACKED_EVENTS] }, deps);
  const total = totalOf(work.perTheme, work.events, query.compare);
  const order = [PRIMARY_EVENTS.themeInstall, PRIMARY_EVENTS.tryTheme, THEME_VIEW_EVENT, ...SUPPORTING_EVENTS.filter((e) => e !== THEME_VIEW_EVENT)];
  const events = order.map((eventName) => {
    const cur = total.current.events[eventName];
    const prev = total.previous?.events[eventName] ?? null;
    return {
      eventName,
      role: roleOf(eventName),
      count: compareValues(cur.count, prev ? prev.count : null),
      users: compareValues(cur.users, prev ? prev.users : null),
    };
  });
  const basis = work.perTheme.length ? basisOf(total.current, total.previous) : "unique";
  return { meta: buildMeta(work.ctx, work.breakdown, basis, work.warnings, deps.now()), events };
}

// ---- User journey ----

export type JourneyStepRow = JourneyStep & { comparison: { users: Change; ofPrevious: Change } | null };
export type JourneyResponse = { meta: MetricsMeta; steps: JourneyStepRow[] };

/**
 * Session → Page View → Theme View → Try Theme → Theme Install as aggregate
 * step counts (see journeySteps). A note in meta says plainly that these
 * aren't sequences. Honours the same theme, date and filter query as
 * /overview.
 */
export async function getJourney(query: MetricsQuery, deps: EngineDeps = defaultEngineDeps): Promise<JourneyResponse> {
  const work = await computePerThemeKpis({ ...query, events: [...new Set([...query.events, ...JOURNEY_EVENTS])] }, deps);
  const total = totalOf(work.perTheme, work.events, query.compare);
  const current = journeySteps(total.current);
  const previous = total.previous ? journeySteps(total.previous) : null;
  const steps = current.map((step, i) => ({
    ...step,
    comparison: previous
      ? { users: compareValues(step.users, previous[i].users), ofPrevious: compareValues(step.ofPrevious, previous[i].ofPrevious) }
      : null,
  }));
  const basis = work.perTheme.length ? basisOf(total.current, total.previous) : "unique";
  const meta = buildMeta(work.ctx, work.breakdown, basis, work.warnings, deps.now());
  meta.notes.unshift(JOURNEY_NOTE);
  return { meta, steps };
}
