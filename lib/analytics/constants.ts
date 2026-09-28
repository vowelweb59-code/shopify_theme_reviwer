// GA4 analytics — shared vocabulary for the models (models/analytics-*.ts,
// models/google-connection.ts) and, in later phases, the sync pipeline and
// analytics engine. Phase 1 foundation only: nothing here talks to Google.
// See ga4-analytics-architecture.md for the full design.

/** The two business events the dashboard is built around. */
export const PRIMARY_EVENTS = {
  themeInstall: "shopify_theme_install",
  tryTheme: "add_to_cart", // the "Try Theme" button fires GA4's add_to_cart
} as const;

/**
 * The only events synced from GA4 (2026-09-28: the user asked for installs
 * and Try Theme only). Views, sessions and users aren't stored.
 */
export const TRACKED_EVENTS = [PRIMARY_EVENTS.themeInstall, PRIMARY_EVENTS.tryTheme] as const;

// GA4 caps a report at 9 dimensions and collapses high-cardinality
// combinations into "(other)", so one row per full dimension combination
// isn't storable. Instead each breakdown is its own small report of
// date x eventName x one dimension. Filters across breakdowns (e.g.
// country + device) can't be answered from these rows — see the
// architecture doc's "Known limitations". Traffic source/medium/campaign
// and channel were dropped on 2026-09-28 (the user found them not useful).
export const AGGREGATE_BREAKDOWNS = {
  total: [],
  country: ["country"],
  device: ["deviceCategory"],
  landingPage: ["landingPage"],
  page: ["pagePath"],
} as const satisfies Record<string, readonly AggregateDimension[]>;

export type AggregateBreakdown = keyof typeof AGGREGATE_BREAKDOWNS;

/** GA4 Data API dimension names, used verbatim as keys of AnalyticsAggregate.dims. */
export type AggregateDimension =
  | "country"
  | "deviceCategory"
  | "landingPage"
  | "pagePath";

/**
 * Deterministic key for a row's dimension values — part of
 * AnalyticsAggregate's unique index, so re-syncing the same day upserts
 * instead of duplicating. Only dimensions belonging to the breakdown
 * count, in the breakdown's fixed order.
 */
export function buildDimsKey(breakdown: AggregateBreakdown, dims: Partial<Record<AggregateDimension, string | null>>): string {
  return AGGREGATE_BREAKDOWNS[breakdown].map((d) => `${d}=${dims[d] ?? ""}`).join("|");
}

/** GA4 reports calendar dates in the property's own time zone, stored as-is. */
export const GA4_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A GA4 property id is its numeric id alone (the API's "properties/<id>" prefix is added at call time). */
export const GA4_PROPERTY_ID_PATTERN = /^\d{6,15}$/;
