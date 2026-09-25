"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TRACKED_EVENTS } from "@/lib/analytics/constants";
import { DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/analytics/engine/dateRanges";
import { FILTER_PARAM_NAMES, type FilterParam } from "@/lib/analytics/engine/filters";

// The dashboard's global state lives in the URL (?theme=&range=&start=&end=
// &compare=&event=&country=&device=...), so a view can be bookmarked or
// shared, the back button undoes a change, and every analytics sub-page
// sees the same selection. The names are exactly what
// /api/analytics/metrics/* accepts, so the API query is built from them.

export type DashboardFilters = Partial<Record<FilterParam, string>>;

export type DashboardParams = {
  theme: string; // "all" or a theme slug
  range: DateRangePreset;
  start: string | null;
  end: string | null;
  compare: boolean;
  /** One extra tracked event to report alongside the funnel events (the "Event" filter). */
  event: string | null;
  filters: DashboardFilters;
};

const DEFAULTS = { theme: "all", range: "last30" as DateRangePreset };
const TRACKED = new Set<string>(TRACKED_EVENTS);

export function paramsToQuery(p: DashboardParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (p.theme !== DEFAULTS.theme) qs.set("theme", p.theme);
  if (p.range !== DEFAULTS.range) qs.set("range", p.range);
  if (p.range === "custom" && p.start && p.end) {
    qs.set("start", p.start);
    qs.set("end", p.end);
  }
  if (!p.compare) qs.set("compare", "none");
  if (p.event) qs.set("event", p.event);
  for (const name of FILTER_PARAM_NAMES) {
    const value = p.filters[name];
    if (value) qs.set(name, value);
  }
  return qs;
}

export function useDashboardParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo<DashboardParams>(() => {
    const range = searchParams.get("range");
    const event = searchParams.get("event");
    const filters: DashboardFilters = {};
    for (const name of FILTER_PARAM_NAMES) {
      const value = searchParams.get(name);
      if (value) filters[name] = value;
    }
    return {
      theme: searchParams.get("theme") || DEFAULTS.theme,
      range: range && (DATE_RANGE_PRESETS as readonly string[]).includes(range) ? (range as DateRangePreset) : DEFAULTS.range,
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      compare: searchParams.get("compare") !== "none",
      event: event && TRACKED.has(event) ? event : null,
      filters,
    };
  }, [searchParams]);

  const setParams = useCallback(
    (patch: Partial<DashboardParams>) => {
      const query = paramsToQuery({ ...params, ...patch }).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  // A custom range without both dates isn't requestable yet: the controls
  // show the date pickers, and nothing is fetched until both are chosen.
  const ready = params.range !== "custom" || Boolean(params.start && params.end);

  // What every metrics endpoint gets: theme, range, comparison, the extra
  // event (as `events`) and the dimension filters.
  const apiQuery = useMemo(() => {
    const qs = new URLSearchParams({ theme: params.theme, range: params.range, compare: params.compare ? "previous" : "none" });
    if (params.range === "custom" && params.start && params.end) {
      qs.set("start", params.start);
      qs.set("end", params.end);
    }
    if (params.event) qs.set("events", params.event);
    for (const [name, value] of Object.entries(params.filters)) qs.set(name, value as string);
    return qs.toString();
  }, [params]);

  /** The current selection as a query string, for links between analytics pages. */
  const linkQuery = useMemo(() => paramsToQuery(params).toString(), [params]);

  return { params, setParams, ready, apiQuery, linkQuery };
}
