// A job that runs once at boot (after `firstDelayMs`, 0 = at once) and then again `intervalMs` after each run ends (so runs never overlap in this process).
// State lives on globalThis under `key`, so a dev-server hot reload doesn't start a second loop. A run that throws is logged
// and the loop carries on. Used by the Chat and attendance syncs, which each had their own copy of this.

type LoopState = { timer: ReturnType<typeof setTimeout> | null; started: boolean; running: boolean };
const g = globalThis as typeof globalThis & { _repeatingJobs?: Map<string, LoopState> };

export function createRepeatingJob(key: string, label: string, intervalMs: number, run: () => Promise<void>, firstDelayMs = 0) {
  const jobs = (g._repeatingJobs ??= new Map());
  let state = jobs.get(key);
  if (!state) {
    state = { timer: null, started: false, running: false };
    jobs.set(key, state);
  }
  const s = state;

  async function runOnce() {
    if (s.running) return;
    s.running = true;
    try {
      await run();
    } catch (err) {
      console.error(`[${label}] scheduled sync failed:`, err instanceof Error ? err.message : err);
    } finally {
      s.running = false;
      if (s.timer) clearTimeout(s.timer);
      const timer = setTimeout(() => void runOnce(), intervalMs);
      timer.unref?.();
      s.timer = timer;
    }
  }

  /** Runs now, then repeats. Calling it again is a no-op. */
  return async function start() {
    if (s.started) return;
    s.started = true;
    // A delay spreads the boot (or a wake from sleep) so the first page requests are not competing with every sync at once.
    if (firstDelayMs > 0) {
      const t = setTimeout(() => void runOnce(), firstDelayMs);
      t.unref?.();
      s.timer = t;
    } else void runOnce();
  };
}
