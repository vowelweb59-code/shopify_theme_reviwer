import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreCheckState } from "@/models/demo-store-check-state";
import { runDemoStoreCheck } from "./runCheck";

// Hourly, with a few minutes of random drift so checks don't land on the
// same clock minute every time. The storefront never reveals *when* a theme
// was published, so the check interval is the precision of every "went
// live" / "went off" time and duration on the page (see liveWindow.ts) —
// hourly keeps that to about an hour. One small storefront GET per hour.
const MIN_INTERVAL_MS = 60 * 60 * 1000;
const MAX_JITTER_MS = 5 * 60 * 1000;

function randomNextDelayMs(): number {
  return MIN_INTERVAL_MS + Math.random() * MAX_JITTER_MS;
}

// Cached on globalThis (same reasoning as lib/db/connect.ts's mongoose
// cache) so a dev-server hot-reload doesn't start a second parallel
// scheduler with its own setTimeout.
const globalForScheduler = globalThis as typeof globalThis & {
  _demoStoreScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean };
};
const schedulerState = (globalForScheduler._demoStoreScheduler ??= { timer: null, started: false });

function scheduleTimer(nextAt: Date) {
  if (schedulerState.timer) clearTimeout(schedulerState.timer);
  const delay = Math.max(0, nextAt.getTime() - Date.now());
  const timer = setTimeout(() => void runAndReschedule(), delay);
  timer.unref?.(); // don't let this alone keep the process alive
  schedulerState.timer = timer;
}

async function runAndReschedule({ manual = false }: { manual?: boolean } = {}) {
  try {
    await runDemoStoreCheck({ manual });
  } catch (err) {
    console.error("[demo-store] scheduled check failed:", err);
  }
  const nextAt = new Date(Date.now() + randomNextDelayMs());
  await connectToDatabase();
  await DemoStoreCheckState.findOneAndUpdate({}, { nextCheckAt: nextAt }, { upsert: true });
  scheduleTimer(nextAt);
}

/** Called once from instrumentation.ts on server boot. */
export async function startDemoStoreScheduler() {
  if (schedulerState.started) return;
  schedulerState.started = true;

  await connectToDatabase();
  let state = await DemoStoreCheckState.findOne();
  // A nextCheckAt scheduled under the old daily cadence can be up to 28h
  // out; pull it in so hourly checking starts now, not tomorrow.
  if (state && state.nextCheckAt.getTime() > Date.now() + MIN_INTERVAL_MS + MAX_JITTER_MS) {
    state.nextCheckAt = new Date();
    await state.save();
  }
  if (!state) {
    // First-ever boot: nothing recorded yet, so check right away instead of
    // waiting an hour for the first row to appear.
    state = await DemoStoreCheckState.create({ nextCheckAt: new Date() });
  }
  scheduleTimer(state.nextCheckAt);
}

/**
 * Used by the "Check Now" API route. Cancels whatever automatic check was
 * pending, runs one immediately, and reschedules from this moment — so a
 * manual check doesn't leave the automatic one to still fire a few hours
 * later (the "at most one check per interval" rule holds regardless of who
 * triggered it).
 */
export async function triggerDemoStoreCheckNow() {
  if (schedulerState.timer) clearTimeout(schedulerState.timer);
  await runAndReschedule({ manual: true });
}
