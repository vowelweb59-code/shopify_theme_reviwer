import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreCheckState } from "@/models/demo-store-check-state";
import { runDemoStoreCheck } from "./runCheck";

// Never more than one check per 24h, but at a randomized time each day
// (rather than a fixed clock time) — up to 4h of drift added on top of the
// 24h floor.
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_JITTER_MS = 4 * 60 * 60 * 1000;

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
  const timer = setTimeout(runAndReschedule, delay);
  timer.unref?.(); // don't let this alone keep the process alive
  schedulerState.timer = timer;
}

async function runAndReschedule() {
  try {
    await runDemoStoreCheck();
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
  if (!state) {
    // First-ever boot: nothing recorded yet, so check right away instead of
    // waiting up to 28h for the first row to appear.
    state = await DemoStoreCheckState.create({ nextCheckAt: new Date() });
  }
  scheduleTimer(state.nextCheckAt);
}

/**
 * Used by the "Check Now" API route. Cancels whatever automatic check was
 * pending, runs one immediately, and reschedules from this moment — so a
 * manual check doesn't leave the automatic one to still fire a few hours
 * later (the "once in 24h" guarantee holds regardless of who triggered it).
 */
export async function triggerDemoStoreCheckNow() {
  if (schedulerState.timer) clearTimeout(schedulerState.timer);
  await runAndReschedule();
}
