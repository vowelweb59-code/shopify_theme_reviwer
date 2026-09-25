import { connectToDatabase } from "@/lib/db/connect";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { SyncRequestError, defaultSyncDeps, executeSync, recoverInterruptedSyncs, startSync, type SyncDeps } from "./runSync";

// Background GA4 sync, started once per server process from
// instrumentation.ts. A fixed tick rather than per-theme timers, so all
// state lives in MongoDB and a restart loses nothing:
//   1. re-queue jobs a crashed process left "running",
//   2. run queued jobs whose retry time has come,
//   3. start a scheduled sync for every mapped theme not synced recently.
// Work within a tick runs one job at a time, to stay gentle on GA4 quota.
// Set ANALYTICS_SYNC_DISABLED=1 to turn it off (e.g. local dev).
//
// Assumes a single server process (one Render instance). Two processes
// would never run the same theme's job twice (the per-theme lock and the
// atomic queued → running claim prevent it), but each would tick.

const TICK_MS = 15 * 60 * 1000;
const FIRST_TICK_MS = 60 * 1000;
/** A theme is due for a scheduled sync this long after its last attempt. */
export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

const globalForScheduler = globalThis as typeof globalThis & {
  _ga4SyncScheduler?: { started: boolean; running: boolean };
};
const state = (globalForScheduler._ga4SyncScheduler ??= { started: false, running: false });

/** One pass of the scheduler. Exported for tests and for a future "run now" admin action. */
export async function runSchedulerTick(deps: SyncDeps = defaultSyncDeps): Promise<{ resumed: number; started: number }> {
  const now = deps.now();
  await recoverInterruptedSyncs(now);

  const due = await AnalyticsSync.find({ status: "queued", isActive: true, $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }] })
    .select("_id")
    .lean<{ _id: { toString(): string } }[]>();
  for (const job of due) await executeSync(job._id.toString(), deps);

  const activeAccounts = await GoogleConnection.find({ status: "active" }).select("_id").lean<{ _id: unknown }[]>();
  // Nothing connected yet (the normal state until GA4 is set up): skip the
  // per-theme queries entirely.
  if (activeAccounts.length === 0) return { resumed: due.length, started: 0 };
  const themes = await AnalyticsTheme.find({
    isActive: true,
    connectionStatus: "connected",
    ga4PropertyId: { $type: "string" },
    googleConnectionId: { $in: activeAccounts.map((a) => a._id) },
  })
    .select("_id")
    .lean<{ _id: { toString(): string } }[]>();

  let started = 0;
  const cutoff = new Date(now.getTime() - SYNC_INTERVAL_MS);
  for (const theme of themes) {
    // Any recent attempt (even a failed one) counts, so a theme that keeps
    // failing is retried every SYNC_INTERVAL, not every tick.
    const recent = await AnalyticsSync.exists({ analyticsThemeId: theme._id, $or: [{ isActive: true }, { createdAt: { $gt: cutoff } }] });
    if (recent) continue;
    try {
      const { done } = await startSync(theme._id.toString(), "scheduled", deps);
      started++;
      await done;
    } catch (err) {
      if (!(err instanceof SyncRequestError)) console.error("[ga4-sync] scheduled sync failed to start:", err instanceof Error ? err.message : err);
    }
  }
  return { resumed: due.length, started };
}

async function tick() {
  if (state.running) return; // a long first sync can outlast a tick
  state.running = true;
  try {
    await connectToDatabase();
    await runSchedulerTick();
  } catch (err) {
    console.error("[ga4-sync] scheduler tick failed:", err instanceof Error ? err.message : err);
  } finally {
    state.running = false;
  }
}

/** Called once from instrumentation.ts on server boot. */
export async function startGa4SyncScheduler() {
  if (state.started || process.env.ANALYTICS_SYNC_DISABLED === "1") return;
  state.started = true;

  // This process just booted, so nothing can really be running: any job
  // still marked "running" was cut off by the previous process.
  await connectToDatabase();
  await recoverInterruptedSyncs(new Date(), { all: true });

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS).unref?.();
  }, FIRST_TICK_MS).unref?.();
}
