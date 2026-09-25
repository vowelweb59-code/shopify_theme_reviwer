import { Schema, model, models, type InferSchemaType } from "mongoose";
import { AGGREGATE_BREAKDOWNS, GA4_DATE_PATTERN, GA4_PROPERTY_ID_PATTERN } from "@/lib/analytics/constants";

// Cached GA4 report rows — what the dashboard reads instead of calling GA4
// on every page load. One row = one theme x one property-timezone date x
// one breakdown x one event (or ALL_EVENTS) x one set of that breakdown's
// dimension values. Only aggregated metrics are kept, never raw events.
//
// Additivity, which later phases must respect:
//   - eventCount and sessions sum correctly across dates and themes.
//   - totalUsers / activeUsers / newUsers are unique *per row*. Summing
//     them across dates or dimension values counts a returning user once
//     per day, so a multi-day "users" figure can't come from summing daily
//     rows. See ga4-analytics-architecture.md, "Unique users".
const dimsSchema = new Schema(
  {
    country: { type: String, default: null },
    city: { type: String, default: null },
    deviceCategory: { type: String, default: null },
    browser: { type: String, default: null },
    operatingSystem: { type: String, default: null },
    sessionSource: { type: String, default: null },
    sessionMedium: { type: String, default: null },
    sessionCampaignName: { type: String, default: null },
    sessionDefaultChannelGroup: { type: String, default: null },
    landingPage: { type: String, default: null },
    pagePath: { type: String, default: null },
  },
  { _id: false }
);

const metricsSchema = new Schema(
  {
    eventCount: { type: Number, default: 0, min: 0 },
    totalUsers: { type: Number, default: 0, min: 0 },
    activeUsers: { type: Number, default: 0, min: 0 },
    newUsers: { type: Number, default: 0, min: 0 },
    sessions: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const analyticsAggregateSchema = new Schema(
  {
    analyticsThemeId: { type: Schema.Types.ObjectId, ref: "AnalyticsTheme", required: true },
    ga4PropertyId: { type: String, required: true, match: GA4_PROPERTY_ID_PATTERN },
    date: { type: String, required: true, match: GA4_DATE_PATTERN },
    breakdown: { type: String, enum: Object.keys(AGGREGATE_BREAKDOWNS), required: true },
    eventName: { type: String, required: true },
    dims: { type: dimsSchema, default: () => ({}) },
    // buildDimsKey(breakdown, dims): the unique key can't index `dims`
    // directly (a subdocument's key order would matter), so it's flattened.
    // Not `required`: the "total" breakdown's key is legitimately "", which
    // Mongoose's required check treats as missing.
    dimsKey: { type: String, default: "" },
    metrics: { type: metricsSchema, default: () => ({}) },
    syncId: { type: Schema.Types.ObjectId, ref: "AnalyticsSync", default: null },
  },
  { timestamps: true }
);

// Upsert target — makes re-syncing an overlapping date range idempotent.
analyticsAggregateSchema.index(
  { analyticsThemeId: 1, date: 1, breakdown: 1, eventName: 1, dimsKey: 1 },
  { unique: true, name: "aggregate_row_identity" }
);
// Single-theme dashboard reads: one breakdown over a date range.
analyticsAggregateSchema.index({ analyticsThemeId: 1, breakdown: 1, eventName: 1, date: 1 });
// "All Themes" reads: same, across every theme.
analyticsAggregateSchema.index({ breakdown: 1, eventName: 1, date: 1 });

export type AnalyticsAggregateDoc = InferSchemaType<typeof analyticsAggregateSchema>;

export const AnalyticsAggregate = models.AnalyticsAggregate ?? model("AnalyticsAggregate", analyticsAggregateSchema);
