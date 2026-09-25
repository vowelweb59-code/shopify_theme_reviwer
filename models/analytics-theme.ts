import { Schema, model, models, type InferSchemaType } from "mongoose";
import { GA4_DATE_PATTERN, GA4_PROPERTY_ID_PATTERN } from "@/lib/analytics/constants";

// A theme as the GA4 analytics module sees it: a name plus the one GA4
// property (under one Google account) that tracks its demo store. Rows,
// not code, define which themes exist — adding a theme is an insert.
//
// Separate from models/theme.ts (an uploaded, audited theme ZIP) because
// the two don't always line up: a theme can be tracked in GA4 without ever
// being audited here, and vice versa. `themeId` links them when they are
// the same theme, so later phases can show audit + analytics side by side.
//
// A mapping is validated before it's saved, and disconnecting a theme
// unmaps it, so there's no "pending" or "disconnected" state to store. A
// theme whose Google account was disconnected or revoked keeps "connected"
// here; the API reports the account's own status alongside it.
export const ANALYTICS_THEME_CONNECTION_STATUSES = [
  "unmapped", // no GA4 property chosen yet
  "connected", // last validation could read the property
  "error", // last re-validation failed (access removed, property deleted, ...)
] as const;

const analyticsThemeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", default: null },
    googleConnectionId: { type: Schema.Types.ObjectId, ref: "GoogleConnection", default: null },
    ga4PropertyId: { type: String, default: null, match: GA4_PROPERTY_ID_PATTERN },
    ga4PropertyDisplayName: { type: String, default: null },
    // GA4 buckets every event into dates in the *property's* time zone, so
    // "Today"/"This week" must be computed in it too, not the server's.
    ga4PropertyTimeZone: { type: String, default: null },
    connectionStatus: { type: String, enum: ANALYTICS_THEME_CONNECTION_STATUSES, required: true, default: "unmapped" },
    isActive: { type: Boolean, required: true, default: true },
    lastValidatedAt: { type: Date, default: null },
    // Sync bookkeeping (Phase 4). syncedThroughDate is the last property-
    // timezone date whose data is considered final — incremental syncs
    // restart a few days before it, since GA4 keeps revising recent days.
    historyStartDate: { type: String, default: null, match: GA4_DATE_PATTERN },
    syncedThroughDate: { type: String, default: null, match: GA4_DATE_PATTERN },
    lastSuccessfulSyncAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

analyticsThemeSchema.index({ slug: 1 }, { unique: true });
// One property tracks one theme. Partial so any number of unmapped themes
// (null property) can coexist.
analyticsThemeSchema.index(
  { ga4PropertyId: 1 },
  { unique: true, partialFilterExpression: { ga4PropertyId: { $type: "string" } } }
);
analyticsThemeSchema.index({ googleConnectionId: 1 });
analyticsThemeSchema.index({ isActive: 1, name: 1 });

export type AnalyticsThemeDoc = InferSchemaType<typeof analyticsThemeSchema>;

export const AnalyticsTheme = models.AnalyticsTheme ?? model("AnalyticsTheme", analyticsThemeSchema);
