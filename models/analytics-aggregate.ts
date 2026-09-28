import { Schema, model, models, type InferSchemaType } from "mongoose";
import { AGGREGATE_BREAKDOWNS, GA4_DATE_PATTERN, GA4_PROPERTY_ID_PATTERN } from "@/lib/analytics/constants";

// Cached GA4 report rows — what the dashboard reads instead of calling GA4
// on every page load. One row = one theme x one property-timezone date x
// one breakdown x one tracked event (Try Theme or install) x one set of
// that breakdown's dimension values. Only the event count is kept: it adds
// up correctly across dates, dimension values and themes.
//
// A row stores only its own breakdown's dimensions (no null placeholders
// for the rest), to keep the collection small.
const dimsSchema = new Schema(
  {
    country: String,
    deviceCategory: String,
    landingPage: String,
    pagePath: String,
  },
  { _id: false }
);

const metricsSchema = new Schema(
  {
    // Fractional for a shared property's estimated installs.
    eventCount: { type: Number, default: 0, min: 0 },
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
