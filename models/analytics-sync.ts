import { Schema, model, models, type InferSchemaType } from "mongoose";
import { GA4_DATE_PATTERN, GA4_PROPERTY_ID_PATTERN } from "@/lib/analytics/constants";

// One row per GA4 sync job for one theme's property — both the job record
// (status, retries, errors) and the lock that stops two syncs of the same
// theme running at once. Phase 1 defines the shape; Phase 4 runs jobs.
export const ANALYTICS_SYNC_TYPES = ["initial", "incremental", "manual", "scheduled"] as const;
export const ANALYTICS_SYNC_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;

const analyticsSyncSchema = new Schema(
  {
    analyticsThemeId: { type: Schema.Types.ObjectId, ref: "AnalyticsTheme", required: true },
    // Snapshot of the property at job time — the theme's mapping can change
    // later, and the job's rows belong to the property it actually read.
    ga4PropertyId: { type: String, required: true, match: GA4_PROPERTY_ID_PATTERN },
    syncType: { type: String, enum: ANALYTICS_SYNC_TYPES, required: true },
    status: { type: String, enum: ANALYTICS_SYNC_STATUSES, required: true, default: "queued" },
    // true while queued/running, unset once finished. The partial unique
    // index below turns it into a per-theme lock: inserting a second active
    // job for the same theme fails with a duplicate-key error. (A plain
    // boolean rather than `status: {$in: [...]}` because partial indexes
    // only accept $in from MongoDB 6.0, and the hosted Mongo's version
    // isn't pinned.)
    isActive: { type: Boolean, default: undefined },
    rangeStart: { type: String, required: true, match: GA4_DATE_PATTERN },
    rangeEnd: { type: String, required: true, match: GA4_DATE_PATTERN },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    attempt: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, default: 3, min: 1 },
    nextRetryAt: { type: Date, default: null },
    // Resume point: the first date not yet synced. A job works through
    // [rangeStart, rangeEnd] in date chunks, oldest first, and advances this
    // after each chunk is fully stored — a retry or a restarted server picks
    // up here instead of starting over.
    cursorDate: { type: String, default: null, match: GA4_DATE_PATTERN },
    chunksTotal: { type: Number, default: 0, min: 0 },
    chunksDone: { type: Number, default: 0, min: 0 },
    rowsFetched: { type: Number, default: 0, min: 0 },
    rowsUpserted: { type: Number, default: 0, min: 0 },
    // GA4 data-quality flags seen in this job's responses (e.g. small
    // counts withheld by thresholding, or rare values rolled into
    // "(other)") — shown next to the numbers rather than hidden.
    warnings: { type: [String], default: () => [] },
    error: {
      message: { type: String, default: null },
      code: { type: String, default: null },
    },
  },
  { timestamps: true }
);

analyticsSyncSchema.index({ analyticsThemeId: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
analyticsSyncSchema.index({ analyticsThemeId: 1, createdAt: -1 });
analyticsSyncSchema.index({ status: 1, nextRetryAt: 1 });

export type AnalyticsSyncDoc = InferSchemaType<typeof analyticsSyncSchema>;

export const AnalyticsSync = models.AnalyticsSync ?? model("AnalyticsSync", analyticsSyncSchema);
