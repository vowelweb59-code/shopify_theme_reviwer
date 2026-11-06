import { connectToDatabase } from "@/lib/db/connect";
import { ShopifyApp } from "@/models/shopify-app";
import { startShopifyAppsCrawl } from "./crawlApps";

// Keeps the App Store data fresh without a manual click: one read a day at a randomized time. Each read re-lists every
// category (so new apps and rating changes show up) and reads the next batch of app pages, so launch dates and star
// splits fill in over a few weeks — and repeated reads are what let the tab show what changed.
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_JITTER_MS = 2 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 2 * 60 * 1000; // stale data is read shortly after boot, not during it

// Cached on globalThis so a dev-server hot-reload doesn't start a second parallel scheduler.
const g = globalThis as typeof globalThis & { _shopifyAppsScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean } };
const state = (g._shopifyAppsScheduler ??= { timer: null, started: false });

function scheduleTimer(delayMs: number) {
  if (state.timer) clearTimeout(state.timer);
  const timer = setTimeout(runAndReschedule, Math.max(0, delayMs));
  timer.unref?.();
  state.timer = timer;
}

async function runAndReschedule() {
  try {
    // Joins a read already in progress (e.g. a manual one) rather than starting a parallel one.
    await startShopifyAppsCrawl();
  } catch (err) {
    console.error("[shopifyApps] scheduled refresh failed:", err);
  }
  scheduleTimer(MIN_INTERVAL_MS + Math.random() * MAX_JITTER_MS);
}

/** Called once from instrumentation.ts on server boot. */
export async function startShopifyAppsScheduler() {
  if (state.started) return;
  state.started = true;

  await connectToDatabase();
  // The last read is whenever the listings step last touched an app; a manual refresh counts too.
  const latest = await ShopifyApp.findOne().sort({ lastSeenAt: -1 }).select("lastSeenAt").lean<{ lastSeenAt: Date } | null>();
  // Nothing read yet: the first read is the "Read App Store" button's, so a fresh install doesn't start crawling on its own.
  if (!latest) return;
  scheduleTimer(Math.max(latest.lastSeenAt.getTime() + MIN_INTERVAL_MS - Date.now(), BOOT_DELAY_MS));
}
