import { connectToDatabase } from "@/lib/db/connect";
import { ThemeStoreTheme } from "@/models/theme-store-theme";
import { startThemeStoreCrawl } from "./crawlCatalog";

// Keeps the Theme Store catalog (every theme, its categories, features, suggested app) fresh without a manual
// "Refresh Theme Store" click. One read a day at a randomized time, like lib/themes/rankingScheduler.ts — and since
// a read only re-opens theme pages not read in the last week, a daily run is mostly the catalog + category pages
// plus any theme that is new (so a theme added to the store shows up, apps included, within about a day).
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_JITTER_MS = 2 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 2 * 60 * 1000; // a stale catalog is read shortly after boot, not during it

// Cached on globalThis so a dev-server hot-reload doesn't start a second parallel scheduler.
const g = globalThis as typeof globalThis & { _themeStoreScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean } };
const state = (g._themeStoreScheduler ??= { timer: null, started: false });

function scheduleTimer(delayMs: number) {
  if (state.timer) clearTimeout(state.timer);
  const timer = setTimeout(runAndReschedule, Math.max(0, delayMs));
  timer.unref?.();
  state.timer = timer;
}

async function runAndReschedule() {
  try {
    // Joins a read already in progress (e.g. a manual one) rather than starting a parallel one.
    await startThemeStoreCrawl();
  } catch (err) {
    console.error("[themeStore] scheduled refresh failed:", err);
  }
  scheduleTimer(MIN_INTERVAL_MS + Math.random() * MAX_JITTER_MS);
}

/** Called once from instrumentation.ts on server boot. */
export async function startThemeStoreScheduler() {
  if (state.started) return;
  state.started = true;

  await connectToDatabase();
  // The last read is whenever the catalog step last touched a theme — no separate state to keep, and a manual refresh counts too.
  const latest = await ThemeStoreTheme.findOne().sort({ lastSeenAt: -1 }).select("lastSeenAt").lean<{ lastSeenAt: Date } | null>();
  const dueAt = latest ? latest.lastSeenAt.getTime() + MIN_INTERVAL_MS : 0;
  scheduleTimer(Math.max(dueAt - Date.now(), BOOT_DELAY_MS));
}
