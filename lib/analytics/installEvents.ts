import "server-only";
import { analyticsdata } from "@googleapis/analyticsdata";
import { GOOGLE_API_TIMEOUT_MS } from "@/lib/google/timeouts";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { PRIMARY_EVENTS } from "./constants";
import { resolvePeriod, type DateRange, type DateRangeSpec } from "./engine/dateRanges";
import { Ga4ConnectionError, getAuthorizedClient } from "./googleConnections";
import { matchesAlias, pickThemeDimension, themeAliases } from "./installAttribution";
import { MAX_INSTALL_DIMENSIONS, pickInstallDimensions, type InstallDimension } from "./installDimensions";
import { themeNames } from "./themeNames";
import { fromGa4Date } from "./sync/dates";
import { classifyDataApiError, createDataApi, runFullReport } from "./sync/ga4Client";

// The theme-install event with the details it carries (the installing store's URL and title, whatever parameters the property
// has registered), read live from GA4 for the dashboard's theme and date range. Not stored: installs are few, GA4 keeps event
// data for months, and the registered parameter names belong to each property. One result per GA4 property, because themes
// that share a property (a page-path prefix each) share its install events, and installs carry no page to tell them apart.

export type InstallRow = { date: string; installs: number; values: string[] };
export type InstallGroup = {
  propertyId: string;
  /** The themes tracked in this property. More than one means the installs below are the whole property's. */
  themes: string[];
  range: DateRange;
  dimensions: InstallDimension[];
  rows: InstallRow[];
  total: number;
  /** The theme the rows were narrowed to, using the event parameter that names the theme (only for one theme on a shared property). */
  filteredTo: string | null;
  /** Installs with no theme value (before the parameter was recorded), which a narrowed view leaves out. */
  unnamed: number;
  error: string | null;
};

type ThemeLean = { name: string; pagePathPrefix?: string | null; themeId?: { toString(): string } | null; googleConnectionId: { toString(): string }; ga4PropertyId: string; ga4PropertyTimeZone: string | null };
type Only = { name: string; aliases: string[] };

const message = (err: unknown) => (err instanceof Ga4ConnectionError ? err.message : classifyDataApiError(err).message);

async function readGroup(connectionId: string, propertyId: string, themes: string[], timeZone: string | null, spec: DateRangeSpec, only: Only | null): Promise<InstallGroup> {
  const range = resolvePeriod(spec, timeZone, false).current;
  const group: InstallGroup = { propertyId, themes, range, dimensions: [], rows: [], total: 0, filteredTo: null, unnamed: 0, error: null };
  try {
    const auth = await getAuthorizedClient(connectionId);
    const metadata = await analyticsdata({ version: "v1beta", auth, timeout: GOOGLE_API_TIMEOUT_MS }).properties.getMetadata({ name: `properties/${propertyId}/metadata` });
    const all = (metadata.data.dimensions ?? []).map((d) => ({ apiName: d.apiName ?? "", uiName: d.uiName ?? "" }));
    group.dimensions = pickInstallDimensions(all);
    // The parameter that names the theme is always shown, and is what a one-theme view narrows by.
    const themeParameter = pickThemeDimension(all);
    if (themeParameter && !group.dimensions.some((d) => d.apiName === themeParameter)) {
      group.dimensions = [{ apiName: themeParameter, label: all.find((d) => d.apiName === themeParameter)?.uiName || themeParameter.replace("customEvent:", "") }, ...group.dimensions].slice(0, MAX_INSTALL_DIMENSIONS);
    }
    const report = await runFullReport(createDataApi(auth), propertyId, {
      dateRanges: [{ startDate: range.start, endDate: range.end }],
      dimensions: [{ name: "date" }, ...group.dimensions.map((d) => ({ name: d.apiName }))],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: PRIMARY_EVENTS.themeInstall } } },
      orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
    });
    group.rows = report.rows.map((r) => ({ date: fromGa4Date(r.dimensions[0]), installs: r.metrics[0] ?? 0, values: r.dimensions.slice(1) }));
    const at = themeParameter ? group.dimensions.findIndex((d) => d.apiName === themeParameter) : -1;
    if (only && at >= 0) {
      const unset = (v: string | undefined) => !v || v === "(not set)";
      group.unnamed = group.rows.filter((r) => unset(r.values[at])).reduce((sum, r) => sum + r.installs, 0);
      group.rows = group.rows.filter((r) => matchesAlias(r.values[at] ?? "", only.aliases));
      group.filteredTo = only.name;
    }
    group.total = group.rows.reduce((sum, r) => sum + r.installs, 0);
  } catch (err) {
    group.error = message(err);
  }
  return group;
}

/** Install events for one theme (by slug) or every mapped theme ("all"), newest first. */
export async function fetchInstallEvents(themeSlug: string, spec: DateRangeSpec): Promise<InstallGroup[]> {
  const filter = themeSlug === "all" ? { isActive: true } : { slug: themeSlug };
  const themes = (await AnalyticsTheme.find({ ...filter, ga4PropertyId: { $type: "string" }, googleConnectionId: { $ne: null } })
    .select("name themeId pagePathPrefix googleConnectionId ga4PropertyId ga4PropertyTimeZone")
    .sort({ name: 1 })
    .lean()) as unknown as ThemeLean[];
  const byProperty = new Map<string, { connectionId: string; propertyId: string; timeZone: string | null; names: string[] }>();
  for (const t of themes) {
    const key = `${t.googleConnectionId.toString()}:${t.ga4PropertyId}`;
    const entry = byProperty.get(key) ?? { connectionId: t.googleConnectionId.toString(), propertyId: t.ga4PropertyId, timeZone: t.ga4PropertyTimeZone, names: [] };
    entry.names.push(t.name);
    byProperty.set(key, entry);
  }
  // One theme asked for: narrow a shared property's installs to it by the names its install events use (the theme and its presets).
  const only: Only | null = themeSlug !== "all" && themes[0]?.pagePathPrefix ? { name: themes[0].name, aliases: themeAliases(await themeNames(themes[0])) } : null;
  return Promise.all([...byProperty.values()].map((p) => readGroup(p.connectionId, p.propertyId, p.names, p.timeZone, spec, only)));
}
