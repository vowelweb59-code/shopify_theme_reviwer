import { connectToDatabase } from "@/lib/db/connect";
import { ThemeRankingCheckState } from "@/models/theme-ranking-check-state";
import { runThemeStoreRankingCheck } from "./runRankingCheck";

// Same cadence/jitter policy as lib/demoStore/scheduler.ts: never more than
// one crawl per 24h, at a randomized time rather than a fixed clock time.
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_JITTER_MS = 4 * 60 * 60 * 1000;

function randomNextDelayMs(): number {
  return MIN_INTERVAL_MS + Math.random() * MAX_JITTER_MS;
}

// Cached on globalThis so a dev-server hot-reload doesn't start a second
// parallel scheduler with its own setTimeout — same reasoning as the
// demo-store scheduler and lib/db/connect.ts's mongoose cache.
const globalForScheduler = globalThis as typeof globalThis & {
  _themeRankingScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean };
};
const schedulerState = (globalForScheduler._themeRankingScheduler ??= { timer: null, started: false });

function scheduleTimer(nextAt: Date) {
  if (schedulerState.timer) clearTimeout(schedulerState.timer);
  const delay = Math.max(0, nextAt.getTime() - Date.now());
  const timer = setTimeout(runAndReschedule, delay);
  timer.unref?.();
  schedulerState.timer = timer;
}

async function runAndReschedule() {
  try {
    await runThemeStoreRankingCheck();
  } catch (err) {
    console.error("[theme-ranking] scheduled check failed:", err);
  }
  const nextAt = new Date(Date.now() + randomNextDelayMs());
  await connectToDatabase();
  await ThemeRankingCheckState.findOneAndUpdate({}, { nextCheckAt: nextAt }, { upsert: true });
  scheduleTimer(nextAt);
}

/** Called once from instrumentation.ts on server boot. */
export async function startThemeRankingScheduler() {
  if (schedulerState.started) return;
  schedulerState.started = true;

  await connectToDatabase();
  let state = await ThemeRankingCheckState.findOne();
  if (!state) {
    // First-ever boot: crawl right away instead of waiting up to 28h for
    // the first rank to appear.
    state = await ThemeRankingCheckState.create({ nextCheckAt: new Date() });
  }
  scheduleTimer(state.nextCheckAt);
}

/**
 * Used by the "Check Ranking" API route. Cancels whatever automatic crawl
 * was pending, runs one immediately, and reschedules from this moment —
 * same "once in 24h regardless of who triggered it" guarantee as the
 * demo-store scheduler's triggerDemoStoreCheckNow.
 */
export async function triggerThemeRankingCheckNow() {
  if (schedulerState.timer) clearTimeout(schedulerState.timer);
  await runAndReschedule();
}
