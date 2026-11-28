import "server-only";
import { analyticsdata } from "@googleapis/analyticsdata";
import { GOOGLE_API_TIMEOUT_MS } from "@/lib/google/timeouts";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { PRIMARY_EVENTS } from "./constants";
import { resolvePeriod, type DateRange, type DateRangeSpec } from "./engine/dateRanges";
import { Ga4ConnectionError, getAuthorizedClient } from "./googleConnections";
import { matchesAlias, pickThemeDimension, splitByTheme, themeAliases } from "./installAttribution";
import { MAX_INSTALL_DIMENSIONS, pickInstallDimensions, type InstallDimension } from "./installDimensions";
import { themeNames } from "./themeNames";
import { fromGa4Date } from "./sync/dates";
import { classifyDataApiError, createDataApi, runFullReport } from "./sync/ga4Client";

// The theme-install event with the details it carries (the installing store's URL and title, whatever parameters the property
// has registered), read live from GA4 for the dashboard's theme and date range. Not stored: installs are few, GA4 keeps event
// data for months, and the registered parameter names belong to each property. The property is read once. Themes that share a
// property (a page-path prefix each) share its install events and installs carry no page, but each event names its theme in a custom
// parameter: when the property has one, the all-themes view splits the installs into ONE TABLE PER THEME (owner, 2026-11-28), and installs
// that cannot be given to a theme (no theme recorded, or a theme not tracked here) get a table of their own so no install disappears.
// Without that parameter a shared property stays one combined table.

export type InstallRow = { date: string; installs: number; values: string[] };
export type InstallGroup = {
  propertyId: string;
  /** The themes this table is about. More than one means the installs below are the whole property's (no column names the theme). */
  themes: string[];
  range: DateRange;
  dimensions: InstallDimension[];
  rows: InstallRow[];
  total: number;
  /** The theme the rows were narrowed to, using the event parameter that names the theme (a shared property). */
  filteredTo: string | null;
  /** Installs with no theme value (before the parameter was recorded), which a narrowed view leaves out. */
  unnamed: number;
  /** Set on the extra table of a split shared property: the installs that belong to none of its themes (no theme recorded, or a theme not tracked). */
  leftover: "unnamed" | "other" | null;
  error: string | null;
};

type ThemeLean = {
  name: string;
  pagePathPrefix?: string | null;
  themeId?: { toString(): string } | null;
  googleConnectionId: { toString(): string };
  ga4PropertyId: string;
  ga4PropertyTimeZone: string | null;
};
type Only = { name: string; aliases: string[] };
type Property = { connectionId: string; propertyId: string; timeZone: string | null; names: string[]; aliases: Map<string, string[]> };
type Base = { range: DateRange; dimensions: InstallDimension[]; rows: InstallRow[]; themeAt: number; error: string | null };

const message = (err: unknown) => (err instanceof Ga4ConnectionError ? err.message : classifyDataApiError(err).message);
const isUnset = (v: string | undefined) => !v || v === "(not set)";
const sumInstalls = (rows: InstallRow[]) => rows.reduce((sum, r) => sum + r.installs, 0);

/** One GA4 property's install events, read once: every row with the registered install parameters, and which column (if any) names the theme. */
async function readProperty(connectionId: string, propertyId: string, timeZone: string | null, spec: DateRangeSpec): Promise<Base> {
  const range = resolvePeriod(spec, timeZone, false).current;
  const base: Base = { range, dimensions: [], rows: [], themeAt: -1, error: null };
  try {
    const auth = await getAuthorizedClient(connectionId);
    const metadata = await analyticsdata({ version: "v1beta", auth, timeout: GOOGLE_API_TIMEOUT_MS }).properties.getMetadata({
      name: `properties/${propertyId}/metadata`,
    });
    const all = (metadata.data.dimensions ?? []).map((d) => ({ apiName: d.apiName ?? "", uiName: d.uiName ?? "" }));
    base.dimensions = pickInstallDimensions(all);
    // The parameter that names the theme is always shown, and is what a one-theme view narrows by.
    const themeParameter = pickThemeDimension(all);
    if (themeParameter && !base.dimensions.some((d) => d.apiName === themeParameter)) {
      base.dimensions = [
        { apiName: themeParameter, label: all.find((d) => d.apiName === themeParameter)?.uiName || themeParameter.replace("customEvent:", "") },
        ...base.dimensions,
      ].slice(0, MAX_INSTALL_DIMENSIONS);
    }
    const report = await runFullReport(createDataApi(auth), propertyId, {
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      dimensions: [{ name: "date" }, ...base.dimensions.map((d) => ({ name: d.apiName }))],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: PRIMARY_EVENTS.themeInstall } } },
      orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
    });
    base.rows = report.rows.map((r) => ({ date: fromGa4Date(r.dimensions[0]), installs: r.metrics[0] ?? 0, values: r.dimensions.slice(1) }));
    base.themeAt = themeParameter ? base.dimensions.findIndex((d) => d.apiName === themeParameter) : -1;
  } catch (err) {
    base.error = message(err);
  }
  return base;
}

/** The tables for one property: one combined, one narrowed to a theme (a single theme asked for), or one per theme plus the leftovers. */
async function readGroups(p: Property, spec: DateRangeSpec, only: Only | null): Promise<InstallGroup[]> {
  const base = await readProperty(p.connectionId, p.propertyId, p.timeZone, spec);
  const make = (themes: string[], rows: InstallRow[], extra: Partial<InstallGroup> = {}): InstallGroup => ({
    propertyId: p.propertyId,
    themes,
    range: base.range,
    dimensions: base.dimensions,
    rows,
    total: sumInstalls(rows),
    filteredTo: null,
    unnamed: 0,
    leftover: null,
    error: base.error,
    ...extra,
  });
  if (base.error) return [make(p.names, [])];
  const at = base.themeAt;
  const named = (r: InstallRow) => !isUnset(r.values[at]);
  const unnamed = at >= 0 ? sumInstalls(base.rows.filter((r) => !named(r))) : 0;

  // One theme asked for: the installs that name it (or one of its presets).
  if (only && at >= 0) {
    return [
      make(
        p.names,
        base.rows.filter((r) => matchesAlias(r.values[at] ?? "", only.aliases)),
        { filteredTo: only.name, unnamed }
      ),
    ];
  }
  // Several themes share the property but no column names the theme: one combined table, as before.
  if (p.names.length < 2 || at < 0) return [make(p.names, base.rows)];

  // Several themes share the property and the install event names its theme: one table for each theme.
  const split = splitByTheme(
    base.rows,
    at,
    p.names.map((name) => ({ name, aliases: p.aliases.get(name) ?? [] }))
  );
  const groups = p.names.map((name) => make([name], split.perTheme.get(name) ?? [], { filteredTo: name, unnamed }));
  // Installs that belong to none of them stay visible, in tables of their own.
  const { noTheme, otherTheme } = split;
  if (noTheme.length) groups.push(make(p.names, noTheme, { leftover: "unnamed" }));
  if (otherTheme.length) groups.push(make(p.names, otherTheme, { leftover: "other" }));
  return groups;
}

/** Install events for one theme (by slug) or every mapped theme ("all"), newest first. */
export async function fetchInstallEvents(themeSlug: string, spec: DateRangeSpec): Promise<InstallGroup[]> {
  const filter = themeSlug === "all" ? { isActive: true } : { slug: themeSlug };
  const themes = (await AnalyticsTheme.find({ ...filter, ga4PropertyId: { $type: "string" }, googleConnectionId: { $ne: null } })
    .select("name themeId pagePathPrefix googleConnectionId ga4PropertyId ga4PropertyTimeZone")
    .sort({ name: 1 })
    .lean()) as unknown as ThemeLean[];
  const byProperty = new Map<string, Property>();
  for (const t of themes) {
    const key = `${t.googleConnectionId.toString()}:${t.ga4PropertyId}`;
    const entry = byProperty.get(key) ?? {
      connectionId: t.googleConnectionId.toString(),
      propertyId: t.ga4PropertyId,
      timeZone: t.ga4PropertyTimeZone,
      names: [],
      aliases: new Map<string, string[]>(),
    };
    entry.names.push(t.name);
    byProperty.set(key, entry);
  }
  // A shared property is split by theme, so each of its themes' names (the theme and its presets) are needed.
  if (themeSlug === "all") {
    for (const t of themes) {
      const entry = byProperty.get(`${t.googleConnectionId.toString()}:${t.ga4PropertyId}`)!;
      if (entry.names.length > 1) entry.aliases.set(t.name, themeAliases(await themeNames(t)));
    }
  }
  // One theme asked for: narrow a shared property's installs to it by the names its install events use (the theme and its presets).
  const only: Only | null =
    themeSlug !== "all" && themes[0]?.pagePathPrefix ? { name: themes[0].name, aliases: themeAliases(await themeNames(themes[0])) } : null;
  return (await Promise.all([...byProperty.values()].map((p) => readGroups(p, spec, only)))).flat();
}
