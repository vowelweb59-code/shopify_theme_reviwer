import { connectToDatabase } from "@/lib/db/connect";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { SyncRequestError, countDueSyncs, defaultSyncDeps, drainSyncQueue, recoverInterruptedSyncs, startSync, type SyncDeps } from "./runSync";

// Background GA4 sync, started once per server process from
// instrumentation.ts. A rotation (the user's rule, 2026-09-29): every 14
// minutes one theme's property is synced, the theme synced longest ago
// first, so each theme gets its turn and then the round starts over. All
// state lives in MongoDB, so a restart loses nothing. Each step:
//   1. re-queues jobs a crashed process left "running",
//   2. if jobs are already queued (a new mapping, "Sync now", a retry),
//      lets the worker run those first — the rotation waits,
//   3. otherwise queues the next theme in the rotation and runs it.
// Set ANALYTICS_SYNC_DISABLED=1 to turn it off (e.g. local dev).
//
// Each step also requests the app's own public /api/health: Render's free
// plan puts an instance to sleep after ~15 minutes without incoming web
// requests (background work doesn't count), which would stop the rotation.
//
// Assumes a single server process (one Render instance). Two processes
// would never run the same theme's job twice (the per-theme lock and the
// atomic queued → running claim prevent it), but each would tick.

export const TICK_MS = 14 * 60 * 1000;
const FIRST_TICK_MS = 60 * 1000;
const KEEP_ALIVE_TIMEOUT_MS = 20_000;

const globalForScheduler = globalThis as typeof globalThis & {
  _ga4SyncScheduler?: { started: boolean; running: boolean };
};
const state = (globalForScheduler._ga4SyncScheduler ??= { started: false, running: false });

/** The mapped, usable theme whose latest sync attempt is oldest (never synced first), skipping themes with a job in progress. */
async function nextThemeInRotation(): Promise<string | null> {
  const activeAccounts = await GoogleConnection.find({ status: "active" }).select("_id").lean<{ _id: unknown }[]>();
  // Nothing connected yet (the normal state until GA4 is set up): no themes to ask about.
  if (activeAccounts.length === 0) return null;
  const themes = await AnalyticsTheme.find({
    isActive: true,
    connectionStatus: "connected",
    ga4PropertyId: { $type: "string" },
    googleConnectionId: { $in: activeAccounts.map((a) => a._id) },
  })
    .select("_id name")
    .sort({ name: 1 })
    .lean<{ _id: { toString(): string } }[]>();
  if (themes.length === 0) return null;

  const ids = themes.map((t) => t._id);
  const [latest, busy] = await Promise.all([
    AnalyticsSync.aggregate<{ _id: { toString(): string }; last: Date }>([{ $match: { analyticsThemeId: { $in: ids } } }, { $group: { _id: "$analyticsThemeId", last: { $max: "$createdAt" } } }]),
    AnalyticsSync.distinct("analyticsThemeId", { isActive: true }),
  ]);
  const lastAttempt = new Map(latest.map((l) => [l._id.toString(), new Date(l.last).getTime()]));
  const inProgress = new Set(busy.map((id: { toString(): string }) => id.toString()));
  const candidates = themes.filter((t) => !inProgress.has(t._id.toString()));
  // Stable: never-synced first, then oldest attempt; ties keep name order.
  candidates.sort((a, b) => (lastAttempt.get(a._id.toString()) ?? 0) - (lastAttempt.get(b._id.toString()) ?? 0));
  return candidates[0]?._id.toString() ?? null;
}

/** One rotation step. Exported for tests and for a future "run now" admin action. */
export async function runSchedulerTick(deps: SyncDeps = defaultSyncDeps): Promise<{ resumed: number; started: number; themeId: string | null }> {
  await recoverInterruptedSyncs(deps.now());

  // Jobs already waiting go first; the rotation picks up again next step.
  const resumed = await countDueSyncs(deps.now());
  if (resumed > 0) {
    await drainSyncQueue(deps);
    return { resumed, started: 0, themeId: null };
  }

  const themeId = await nextThemeInRotation();
  if (!themeId) return { resumed: 0, started: 0, themeId: null };
  try {
    await startSync(themeId, "scheduled", deps); // queued; the worker runs it
  } catch (err) {
    // E.g. its account needs reconnecting: skip it this round.
    if (!(err instanceof SyncRequestError)) console.error("[ga4-sync] scheduled sync failed to start:", err instanceof Error ? err.message : err);
    return { resumed: 0, started: 0, themeId };
  }
  await drainSyncQueue(deps);
  return { resumed: 0, started: 1, themeId };
}

/** Requests the app's own public URL so the hosting platform sees traffic and keeps the instance awake. */
async function keepAwake() {
  const base = process.env.APP_URL;
  if (!base || !/^https:\/\//i.test(base)) return; // local dev: nothing to keep awake
  try {
    await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(KEEP_ALIVE_TIMEOUT_MS), cache: "no-store" });
  } catch {
    // Best effort: a missed request only risks one sleep.
  }
}

async function tick() {
  void keepAwake(); // even while a long sync blocks this step
  if (state.running) return; // a long sync (e.g. a full history) can outlast a step
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
