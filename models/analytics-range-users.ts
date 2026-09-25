import { Schema, model, models, type InferSchemaType } from "mongoose";
import { GA4_PROPERTY_ID_PATTERN } from "@/lib/analytics/constants";

// Cached range-level unique-user counts from GA4 — the one figure the daily
// AnalyticsAggregate rows can't produce (daily users don't add up across
// days; see ga4-analytics-architecture.md §4.1). One document = one theme's
// property × one date range × one grouping × one filter set, holding a
// users count per group (a single "" group when ungrouped) plus users per
// requested event.
//
// Entries expire on their own through the TTL index: ranges that include
// the last few days (which GA4 still revises) after an hour, settled
// ranges after 30 days, so the collection stays small.
const groupSchema = new Schema(
  {
    key: { type: String, default: "" },
    users: { type: Number, required: true, min: 0 },
    eventUsers: { type: Map, of: Number, default: () => new Map() },
  },
  { _id: false }
);

const analyticsRangeUsersSchema = new Schema(
  {
    analyticsThemeId: { type: Schema.Types.ObjectId, ref: "AnalyticsTheme", required: true },
    ga4PropertyId: { type: String, required: true, match: GA4_PROPERTY_ID_PATTERN },
    cacheKey: { type: String, required: true },
    groups: { type: [groupSchema], default: [] },
    // GA4 returned the row limit: groups past it are missing, and callers
    // fall back to summed daily users for those.
    truncated: { type: Boolean, default: false },
    warnings: { type: [String], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

analyticsRangeUsersSchema.index({ analyticsThemeId: 1, ga4PropertyId: 1, cacheKey: 1 }, { unique: true });
analyticsRangeUsersSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AnalyticsRangeUsersDoc = InferSchemaType<typeof analyticsRangeUsersSchema>;

export const AnalyticsRangeUsers = models.AnalyticsRangeUsers ?? model("AnalyticsRangeUsers", analyticsRangeUsersSchema);
