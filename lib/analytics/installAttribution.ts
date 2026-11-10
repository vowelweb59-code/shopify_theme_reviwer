import { PRIMARY_EVENTS, buildDimsKey } from "./constants";
import type { MetadataDimension } from "./installDimensions";
import type { ReportRequest, ReportRow } from "./sync/ga4Client";
import { fromGa4Date } from "./sync/dates";
import type { AggregateRow } from "./sync/reports";

// Exact installs for themes that share one GA4 property. The install event (shopify_theme_install) has no page, but it carries an
// event parameter naming the theme it was for; with that registered as a custom dimension, each theme's installs are counted
// from the event itself instead of estimated from its share of Try Theme clicks (reports.ts estimateInstallRows).
//
// A custom dimension is not retroactive: installs from before it was registered have no theme value ("(not set)"). Those stay
// estimated, so history is not lost, and the date from which the parameter exists is kept (installsExactFrom) so a range that
// reaches back before it is still shown as partly estimated. Pure.

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const toGa4Date = (day: string) => day.replace(/-/g, "");
const isUnset = (value: string) => value.trim() === "" || value === "(not set)";

/** The custom event parameter that names the theme ("customEvent:theme_name"), or null when the property has none. Names and titles first. */
export function pickThemeDimension(all: MetadataDimension[]): string | null {
  const themed = all.filter((d) => d.apiName.startsWith("customEvent:") && (/theme/i.test(d.apiName) || /theme/i.test(d.uiName)));
  return (themed.find((d) => /name|title|label/i.test(d.apiName)) ?? themed[0])?.apiName ?? null;
}

/** The names an install event may use for a theme: its own name and each of its presets (an install of "Touch" is an install of Rare). */
export function themeAliases(names: (string | null | undefined)[]): string[] {
  return [...new Set(names.map((n) => norm(n ?? "")).filter(Boolean))];
}

/** Whether an event's theme value is one of the aliases: the whole value, or the alias as whole words inside it ("Rare - Touch"). */
export function matchesAlias(value: string, aliases: string[]): boolean {
  const v = ` ${norm(value)} `;
  return v.trim() !== "" && aliases.some((a) => v.includes(` ${a} `));
}

/** date × event × the theme parameter, for the install event only, over the whole property (no page filter). */
export function installsByThemeRequest(range: { start: string; end: string }, dimension: string): ReportRequest {
  return {
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: [{ name: "date" }, { name: "eventName" }, { name: dimension }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: PRIMARY_EVENTS.themeInstall } } },
  };
}

export type InstallAttribution = {
  /** Per day: installs whose theme value is this theme (or one of its presets). */
  exact: Map<string, number>;
  /** Per day: installs with no theme value at all (before the parameter existed); these are estimated. */
  unattributed: Map<string, number>;
  /** The first day in these rows with any theme value, for any theme: when exact counting starts. */
  firstNamedDate: string | null;
};

/** Splits the install-by-theme report into this theme's exact installs and the ones nobody named; other themes' installs are dropped. */
export function attributeInstalls(rows: readonly ReportRow[], aliases: string[]): InstallAttribution {
  const out: InstallAttribution = { exact: new Map(), unattributed: new Map(), firstNamedDate: null };
  for (const r of rows) {
    if (r.dimensions[1] !== PRIMARY_EVENTS.themeInstall) continue;
    const date = fromGa4Date(r.dimensions[0]);
    const value = r.dimensions[2] ?? "";
    const n = r.metrics[0] ?? 0;
    if (isUnset(value)) {
      out.unattributed.set(date, (out.unattributed.get(date) ?? 0) + n);
      continue;
    }
    if (!out.firstNamedDate || date < out.firstNamedDate) out.firstNamedDate = date;
    if (matchesAlias(value, aliases)) out.exact.set(date, (out.exact.get(date) ?? 0) + n);
  }
  return out;
}

/** One "total" install row per day with a positive count. */
export function installRows(counts: ReadonlyMap<string, number>): AggregateRow[] {
  return [...counts]
    .filter(([, n]) => n > 0)
    .map(([date, n]) => ({ date, breakdown: "total" as const, eventName: PRIMARY_EVENTS.themeInstall, dims: {}, dimsKey: buildDimsKey("total", {}), metrics: { eventCount: n } }));
}

/** Install rows for the same day add up (a day's exact installs plus its estimated share of the unattributed ones). */
export function mergeInstallRows(...sets: AggregateRow[][]): AggregateRow[] {
  const sum = new Map<string, number>();
  for (const r of sets.flat()) sum.set(r.date, (sum.get(r.date) ?? 0) + r.metrics.eventCount);
  return installRows(sum);
}

/** The unattributed installs as property-wide report rows (date, event), the shape the share estimate reads. */
export function unattributedReportRows(unattributed: ReadonlyMap<string, number>): ReportRow[] {
  return [...unattributed].map(([date, n]) => ({ dimensions: [toGa4Date(date), PRIMARY_EVENTS.themeInstall], metrics: [n] }));
}
