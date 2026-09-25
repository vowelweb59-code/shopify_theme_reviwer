// GA4 analytics — shared vocabulary for the models (models/analytics-*.ts,
// models/google-connection.ts) and, in later phases, the sync pipeline and
// analytics engine. Phase 1 foundation only: nothing here talks to Google.
// See ga4-analytics-architecture.md for the full design.

/** The two business events the dashboard is built around. */
export const PRIMARY_EVENTS = {
  themeInstall: "shopify_theme_install",
  tryTheme: "add_to_cart", // the "Try Theme" button fires GA4's add_to_cart
} as const;

/** "Theme Views" in the funnel — a supporting event with a named role. */
export const THEME_VIEW_EVENT = "view_item";

/** Context events — shown, but never allowed to dominate the dashboard. */
export const SUPPORTING_EVENTS = [
  "user_engagement",
  "session_start",
  "first_visit",
  "page_view",
  "view_item",
  "scroll",
  "click",
  "form_start",
  "form_submit",
  "view_search_results",
] as const;

/** Every event the sync pipeline will request per-event rows for. */
export const TRACKED_EVENTS = [PRIMARY_EVENTS.themeInstall, PRIMARY_EVENTS.tryTheme, ...SUPPORTING_EVENTS] as const;

// GA4 caps a report at 9 dimensions and collapses high-cardinality
// combinations into "(other)", so one row per full dimension combination
// isn't storable. Instead each breakdown is its own small report of
// date x eventName x one dimension family. Filters *within* a family
// (e.g. source + medium) combine exactly; filters *across* families
// (e.g. country + device) can't be answered from these rows — see the
// architecture doc's "Known limitations".
export const AGGREGATE_BREAKDOWNS = {
  total: [],
  country: ["country"],
  city: ["country", "city"],
  device: ["deviceCategory"],
  browser: ["browser"],
  os: ["operatingSystem"],
  acquisition: ["sessionSource", "sessionMedium", "sessionCampaignName"],
  // GA4's own traffic-channel grouping (Organic Search, Direct, Paid
  // Social, ...). Not derivable from source/medium without re-implementing
  // GA4's channel rules, so it's asked for directly as its own family.
  channel: ["sessionDefaultChannelGroup"],
  landingPage: ["landingPage"],
  page: ["pagePath"],
} as const satisfies Record<string, readonly AggregateDimension[]>;

export type AggregateBreakdown = keyof typeof AGGREGATE_BREAKDOWNS;

/** GA4 Data API dimension names, used verbatim as keys of AnalyticsAggregate.dims. */
export type AggregateDimension =
  | "country"
  | "city"
  | "deviceCategory"
  | "browser"
  | "operatingSystem"
  | "sessionSource"
  | "sessionMedium"
  | "sessionCampaignName"
  | "sessionDefaultChannelGroup"
  | "landingPage"
  | "pagePath";

export const AGGREGATE_DIMENSIONS: readonly AggregateDimension[] = [
  "country",
  "city",
  "deviceCategory",
  "browser",
  "operatingSystem",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "sessionDefaultChannelGroup",
  "landingPage",
  "pagePath",
];

/**
 * Stored on rows that aggregate over every event (the per-property user and
 * session totals), so eventName is never null and stays part of the
 * unique key. Can't collide with a real GA4 event name, which can't
 * contain parentheses.
 */
export const ALL_EVENTS = "(all)";

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
