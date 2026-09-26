import "server-only";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { Ga4ConnectionError, getAuthorizedClient, markConnectionRevoked } from "../googleConnections";
import { createAdminApi, getPropertyDetails, Ga4PropertyError, type AdminApi } from "../properties";
import { GA4_EARLIEST_DATE, addDays, chunkDateRange, dateInTimeZone, maxDate, todayInTimeZone } from "./dates";
import { Ga4DataError, classifyDataApiError, createDataApi, runFullReport, type DataApi } from "./ga4Client";
import { buildReportSpecs, estimateInstallRows, installEstimateRequest, toAggregateRows, type AggregateRow } from "./reports";

// GA4 → MongoDB sync jobs. One job = one theme's property over a date
// range, worked through in CHUNK_DAYS chunks, oldest first. Callers must
// have run connectToDatabase() first.
//
// Guarantees:
//   - At most one active job per theme (AnalyticsSync's partial unique index).
//   - Idempotent: rows are upserted on their natural key, and after each
//     chunk any older row for those dates that GA4 no longer returns is
//     deleted — so re-syncing a range converges on GA4's current numbers.
//   - Resumable: cursorDate advances only after a chunk is fully stored.

export const CHUNK_DAYS = 30;
// GA4 keeps processing (and revising) the most recent ~72 hours, so every
// incremental sync re-fetches this many days before syncedThroughDate.
export const REFETCH_DAYS = 3;
// A running job whose record hasn't been touched for this long is assumed
// dead (server restarted mid-sync) and is re-queued from its cursor.
export const STALE_AFTER_MS = 30 * 60 * 1000;
const UPSERT_BATCH = 1000;

export type SyncDeps = {
  dataApiFor: (connectionId: string) => Promise<DataApi>;
  adminFor: (connectionId: string) => Promise<AdminApi>;
  now: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** How a retry is scheduled in-process. The scheduler's tick also picks up due retries, so this is an optimisation. */
  scheduleRetry?: (syncId: string, delayMs: number) => void;
};

export const defaultSyncDeps: SyncDeps = {
  dataApiFor: async (id) => createDataApi(await getAuthorizedClient(id)),
  adminFor: async (id) => createAdminApi(await getAuthorizedClient(id)),
  now: () => new Date(),
  scheduleRetry: (syncId, delayMs) => {
    const timer = setTimeout(() => void executeSync(syncId).catch((err) => console.error("[ga4-sync] retry failed:", err instanceof Error ? err.message : err)), delayMs);
    timer.unref?.();
  },
};

export class SyncRequestError extends Error {
  constructor(
    public readonly status: 404 | 409 | 422,
    message: string
  ) {
    super(message);
    this.name = "SyncRequestError";
  }
}

export type PublicSync = {
  id: string;
  themeId: string;
  syncType: string;
  status: string;
  rangeStart: string;
  rangeEnd: string;
  cursorDate: string | null;
  chunksDone: number;
  chunksTotal: number;
  rowsFetched: number;
  rowsUpserted: number;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  error: { message: string | null; code: string | null } | null;
  warnings: string[];
};

type SyncLean = {
  _id: { toString(): string };
  analyticsThemeId: { toString(): string };
  ga4PropertyId: string;
  syncType: string;
  status: string;
  rangeStart: string;
  rangeEnd: string;
  cursorDate?: string | null;
  chunksDone?: number;
  chunksTotal?: number;
  rowsFetched?: number;
  rowsUpserted?: number;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date | null;
  error?: { message?: string | null; code?: string | null } | null;
  warnings?: string[];
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export function toPublicSync(doc: SyncLean): PublicSync {
  return {
    id: doc._id.toString(),
    themeId: doc.analyticsThemeId.toString(),
    syncType: doc.syncType,
    status: doc.status,
    rangeStart: doc.rangeStart,
    rangeEnd: doc.rangeEnd,
    cursorDate: doc.cursorDate ?? null,
    chunksDone: doc.chunksDone ?? 0,
    chunksTotal: doc.chunksTotal ?? 0,
    rowsFetched: doc.rowsFetched ?? 0,
    rowsUpserted: doc.rowsUpserted ?? 0,
    attempt: doc.attempt,
    maxAttempts: doc.maxAttempts,
    nextRetryAt: iso(doc.nextRetryAt),
    startedAt: iso(doc.startedAt),
    completedAt: iso(doc.completedAt),
    createdAt: iso(doc.createdAt),
    error: doc.error?.message ? { message: doc.error.message, code: doc.error.code ?? null } : null,
    warnings: doc.warnings ?? [],
  };
}

type ThemeForSync = {
  _id: { toString(): string };
  name: string;
  googleConnectionId?: { toString(): string } | null;
  ga4PropertyId?: string | null;
  ga4PropertyTimeZone?: string | null;
  pagePathPrefix?: string | null;
  connectionStatus: string;
  historyStartDate?: string | null;
  syncedThroughDate?: string | null;
};

/** Optional floor on history (e.g. to bound storage), from ANALYTICS_HISTORY_START_DATE. */
function configuredHistoryFloor(): string {
  const floor = process.env.ANALYTICS_HISTORY_START_DATE;
  return floor && /^\d{4}-\d{2}-\d{2}$/.test(floor) ? maxDate(floor, GA4_EARLIEST_DATE) : GA4_EARLIEST_DATE;
}

export type SyncTrigger = "manual" | "scheduled" | "mapped";

/** Decides type and date range: full history the first time, a trailing window after that. */
export async function planSync(theme: ThemeForSync, trigger: SyncTrigger, deps: SyncDeps) {
  const today = todayInTimeZone(theme.ga4PropertyTimeZone, deps.now());

  if (!theme.syncedThroughDate) {
    // Everything GA4 still has for this property: back to its creation date.
    let created = GA4_EARLIEST_DATE;
    try {
      const details = await getPropertyDetails(await deps.adminFor(theme.googleConnectionId!.toString()), theme.ga4PropertyId!);
      if (details.createTime) created = dateInTimeZone(details.createTime, theme.ga4PropertyTimeZone);
    } catch (err) {
      if (err instanceof Ga4PropertyError && err.code !== "unavailable") throw err;
      // Couldn't read createTime right now: fall back to GA4's earliest date — just a few extra empty requests.
    }
    const rangeStart = maxDate(created, configuredHistoryFloor());
    return { syncType: "initial" as const, rangeStart: rangeStart > today ? today : rangeStart, rangeEnd: today };
  }

  const floor = theme.historyStartDate ?? configuredHistoryFloor();
  const rangeStart = maxDate(addDays(theme.syncedThroughDate, -REFETCH_DAYS), floor);
  return { syncType: trigger === "manual" ? ("manual" as const) : ("scheduled" as const), rangeStart: rangeStart > today ? today : rangeStart, rangeEnd: today };
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Re-queues running jobs nobody has touched for STALE_AFTER_MS (or all running jobs, e.g. at server boot). */
export async function recoverInterruptedSyncs(now: Date, { all = false }: { all?: boolean } = {}): Promise<number> {
  const result = await AnalyticsSync.updateMany(
    { status: "running", ...(all ? {} : { updatedAt: { $lt: new Date(now.getTime() - STALE_AFTER_MS) } }) },
    { $set: { status: "queued", nextRetryAt: now, "error.message": "Interrupted (the server restarted); resuming from the last completed chunk.", "error.code": "interrupted" } }
  );
  return result.modifiedCount;
}

/**
 * Creates a job for the theme and starts it in the background. `done`
 * resolves when this run of the job ends (succeeded, failed, or queued for
 * a retry). Throws SyncRequestError for an unmapped theme, an account that
 * needs reconnecting, or a job that's already active.
 */
export async function startSync(themeId: string, trigger: SyncTrigger, deps: SyncDeps = defaultSyncDeps): Promise<{ sync: PublicSync; done: Promise<void> }> {
  const theme = await AnalyticsTheme.findById(themeId).lean<ThemeForSync>();
  if (!theme) throw new SyncRequestError(404, "Theme not found.");
  if (!theme.ga4PropertyId || !theme.googleConnectionId) throw new SyncRequestError(422, `${theme.name} isn't mapped to a GA4 property yet.`);
  if (theme.connectionStatus !== "connected") throw new SyncRequestError(422, `${theme.name}'s GA4 mapping has an error — validate it first.`);
  const account = await GoogleConnection.findById(theme.googleConnectionId).select("email status").lean<{ email: string; status: string }>();
  if (account?.status !== "active") throw new SyncRequestError(422, `${account?.email ?? "The theme's Google account"} needs to be reconnected first.`);

  await recoverInterruptedSyncs(deps.now());

  let plan;
  try {
    plan = await planSync(theme, trigger, deps);
  } catch (err) {
    if (err instanceof Ga4PropertyError || err instanceof Ga4ConnectionError) throw new SyncRequestError(422, err.message);
    throw err;
  }

  let created;
  try {
    created = await AnalyticsSync.create({
      analyticsThemeId: theme._id,
      ga4PropertyId: theme.ga4PropertyId,
      syncType: plan.syncType,
      status: "queued",
      isActive: true,
      rangeStart: plan.rangeStart,
      rangeEnd: plan.rangeEnd,
      cursorDate: plan.rangeStart,
      chunksTotal: chunkDateRange(plan.rangeStart, plan.rangeEnd, CHUNK_DAYS).length,
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const active = await AnalyticsSync.findOne({ analyticsThemeId: theme._id, isActive: true }).lean<SyncLean>();
    // "Sync now" on a job that's waiting to retry means: retry it now —
    // except while it's waiting out a GA4 quota, where retrying early just
    // burns more quota and fails the same way.
    const quotaWait = active?.error?.code === "quota_hourly" || active?.error?.code === "quota_daily";
    if (active?.status === "queued" && trigger === "manual" && quotaWait && active.nextRetryAt) {
      throw new SyncRequestError(409, `${theme.name}'s sync is waiting for GA4's API quota to reset; it resumes on its own at ${new Date(active.nextRetryAt).toISOString()}.`);
    }
    if (active?.status === "queued" && trigger === "manual") {
      await AnalyticsSync.updateOne({ _id: active._id, status: "queued" }, { $set: { nextRetryAt: null } });
      const done = executeSync(active._id.toString(), deps).catch((e) => console.error("[ga4-sync] job crashed:", e instanceof Error ? e.message : e));
      return { sync: toPublicSync(active), done };
    }
    throw new SyncRequestError(409, `A sync for ${theme.name} is already ${active?.status === "queued" ? "waiting to retry" : "running"}.`);
  }

  if (plan.syncType === "initial") {
    // Rows from a property this theme used to be mapped to don't belong to it any more.
    await AnalyticsAggregate.deleteMany({ analyticsThemeId: theme._id, ga4PropertyId: { $ne: theme.ga4PropertyId } });
    await AnalyticsTheme.updateOne({ _id: theme._id }, { $set: { historyStartDate: plan.rangeStart } });
  }

  const syncId = created._id.toString();
  const done = executeSync(syncId, deps).catch((err) => console.error("[ga4-sync] job crashed:", err instanceof Error ? err.message : err));
  return { sync: toPublicSync(created.toObject()), done };
}

type UpsertOp = {
  updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: true };
};

/**
 * Runs (or resumes) a queued job. Safe to call concurrently for the same
 * job: only the caller that atomically flips it queued → running proceeds.
 */
export async function executeSync(syncId: string, deps: SyncDeps = defaultSyncDeps): Promise<void> {
  const job = await AnalyticsSync.findOneAndUpdate(
    { _id: syncId, status: "queued", isActive: true },
    { $set: { status: "running", nextRetryAt: null }, $inc: { attempt: 1 } },
    { returnDocument: "after" }
  ).lean<SyncLean>();
  if (!job) return;
  if (!job.startedAt) await AnalyticsSync.updateOne({ _id: syncId }, { $set: { startedAt: deps.now() } });

  const theme = await AnalyticsTheme.findById(job.analyticsThemeId).lean<ThemeForSync>();
  try {
    if (!theme?.googleConnectionId || theme.ga4PropertyId !== job.ga4PropertyId) {
      throw new Ga4DataError("not_found", "The theme was unmapped or moved to another property while syncing.");
    }
    const api = await deps.dataApiFor(theme.googleConnectionId.toString());
    const warnings = new Set(job.warnings ?? []);
    const pagePathPrefix = theme.pagePathPrefix ?? null;

    const upsertRows = async (rows: AggregateRow[], fetched: number) => {
      let written = 0;
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        const ops: UpsertOp[] = rows.slice(i, i + UPSERT_BATCH).map((r) => ({
          updateOne: {
            filter: { analyticsThemeId: job.analyticsThemeId, date: r.date, breakdown: r.breakdown, eventName: r.eventName, dimsKey: r.dimsKey },
            update: { $set: { ga4PropertyId: job.ga4PropertyId, dims: r.dims, metrics: r.metrics, syncId: job._id } },
            upsert: true,
          },
        }));
        const res = await AnalyticsAggregate.bulkWrite(ops, { ordered: false });
        written += res.upsertedCount + res.matchedCount;
      }
      // Also a heartbeat: keeps updatedAt fresh so a long chunk isn't mistaken for a dead job.
      await AnalyticsSync.updateOne({ _id: syncId }, { $inc: { rowsFetched: fetched, rowsUpserted: written } });
    };
    const noteMetadata = (result: { subjectToThresholding: boolean; dataLossFromOtherRow: boolean }) => {
      if (result.subjectToThresholding) warnings.add("GA4 withheld some small counts (data thresholding).");
      if (result.dataLossFromOtherRow) warnings.add('GA4 grouped some rare values into "(other)".');
    };

    for (const chunk of chunkDateRange(job.cursorDate ?? job.rangeStart, job.rangeEnd, CHUNK_DAYS)) {
      // The theme can be remapped, unmapped or given another page filter
      // mid-sync (Settings); stop writing rows that no longer describe it.
      if (!(await AnalyticsTheme.exists({ _id: job.analyticsThemeId, ga4PropertyId: job.ga4PropertyId, pagePathPrefix }))) {
        await AnalyticsSync.updateOne(
          { _id: syncId },
          { $set: { status: "cancelled", completedAt: deps.now(), error: { message: "The theme's GA4 property or page filter changed during the sync.", code: "cancelled" } }, $unset: { isActive: "" } }
        );
        return;
      }
      const themeTotals: AggregateRow[] = [];
      for (const spec of buildReportSpecs(chunk, pagePathPrefix)) {
        const result = await runFullReport(api, job.ga4PropertyId, spec.request, { sleep: deps.sleep });
        noteMetadata(result);
        const rows = toAggregateRows(spec, result.rows);
        if (spec.breakdown === "total" && spec.kind === "events") themeTotals.push(...rows);
        await upsertRows(rows, result.rows.length);
      }
      if (pagePathPrefix) {
        // Installs have no page, so the page filter drops them all; estimate this theme's share instead.
        const result = await runFullReport(api, job.ga4PropertyId, installEstimateRequest(chunk), { sleep: deps.sleep });
        noteMetadata(result);
        await upsertRows(estimateInstallRows(themeTotals, result.rows), result.rows.length);
      }

      // The chunk is complete: anything for these dates this sync didn't write is gone from GA4.
      await AnalyticsAggregate.deleteMany({ analyticsThemeId: job.analyticsThemeId, date: { $gte: chunk.start, $lte: chunk.end }, syncId: { $ne: job._id } });
      await AnalyticsSync.updateOne({ _id: syncId }, { $set: { cursorDate: addDays(chunk.end, 1), warnings: [...warnings] }, $inc: { chunksDone: 1 } });
      await AnalyticsTheme.updateOne(
        { _id: job.analyticsThemeId, ga4PropertyId: job.ga4PropertyId, $or: [{ syncedThroughDate: null }, { syncedThroughDate: { $lt: chunk.end } }] },
        { $set: { syncedThroughDate: chunk.end } }
      );
    }

    const now = deps.now();
    await AnalyticsSync.updateOne({ _id: syncId }, { $set: { status: "succeeded", completedAt: now, error: { message: null, code: null } }, $unset: { isActive: "" } });
    await AnalyticsTheme.updateOne({ _id: job.analyticsThemeId, ga4PropertyId: job.ga4PropertyId }, { $set: { lastSuccessfulSyncAt: now, lastError: null } });
  } catch (raw) {
    await handleFailure(job, theme, raw, deps);
  }
}

/** How long to wait before the next attempt, by failure kind. */
export function retryDelayMs(code: string, attempt: number): number {
  if (code === "quota_hourly") return 65 * 60 * 1000;
  if (code === "quota_daily") return 6 * 60 * 60 * 1000; // re-checks until GA4's daily quota resets
  return 5 * 60 * 1000 * 3 ** Math.max(0, attempt - 1); // 5 min, 15 min, 45 min…
}

async function handleFailure(job: SyncLean, theme: ThemeForSync | null, raw: unknown, deps: SyncDeps) {
  // Ga4ConnectionError: the stored account can't be used (disconnected or
  // already revoked) — nothing to retry, and nothing new to mark.
  const err = raw instanceof Ga4ConnectionError ? new Ga4DataError("auth_revoked", raw.message) : classifyDataApiError(raw);
  if (!(raw instanceof Ga4DataError) && !(raw instanceof Ga4ConnectionError)) {
    console.error("[ga4-sync] unexpected failure:", raw instanceof Error ? raw.message : raw);
  }
  if (err.code === "auth_revoked" && raw instanceof Ga4DataError && theme?.googleConnectionId) await markConnectionRevoked(theme.googleConnectionId.toString());

  // Quota waits are expected on a big first sync and don't use up an attempt.
  const isQuota = err.code === "quota_hourly" || err.code === "quota_daily";
  const attempt = isQuota ? job.attempt - 1 : job.attempt;
  const now = deps.now();

  if (err.retryable && attempt < job.maxAttempts) {
    const delay = retryDelayMs(err.code, attempt);
    await AnalyticsSync.updateOne(
      { _id: job._id },
      { $set: { status: "queued", attempt, nextRetryAt: new Date(now.getTime() + delay), error: { message: err.message, code: err.code } } }
    );
    deps.scheduleRetry?.(job._id.toString(), delay);
    return;
  }

  await AnalyticsSync.updateOne(
    { _id: job._id },
    { $set: { status: "failed", attempt, completedAt: now, error: { message: err.message, code: err.code } }, $unset: { isActive: "" } }
  );
  if (theme) {
    const lostAccess = err.code === "permission_denied" || err.code === "not_found";
    await AnalyticsTheme.updateOne({ _id: theme._id }, { $set: { lastError: `Sync failed: ${err.message}`, ...(lostAccess ? { connectionStatus: "error" } : {}) } });
  }
}

/** The newest job per theme — what the UI shows as each theme's sync state. */
export async function latestSyncByTheme(): Promise<Record<string, PublicSync>> {
  const docs = await AnalyticsSync.aggregate<SyncLean>([{ $sort: { createdAt: -1 } }, { $group: { _id: "$analyticsThemeId", doc: { $first: "$$ROOT" } } }, { $replaceRoot: { newRoot: "$doc" } }]);
  return Object.fromEntries(docs.map((d) => [d.analyticsThemeId.toString(), toPublicSync(d)]));
}

export async function listThemeSyncs(themeId: string, limit = 20): Promise<PublicSync[]> {
  const docs = await AnalyticsSync.find({ analyticsThemeId: themeId }).sort({ createdAt: -1 }).limit(limit).lean<SyncLean[]>();
  return docs.map(toPublicSync);
}
