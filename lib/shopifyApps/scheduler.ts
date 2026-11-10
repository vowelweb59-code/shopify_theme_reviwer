import { connectToDatabase } from "@/lib/db/connect";
import { ShopifyApp } from "@/models/shopify-app";
import { detailBacklog, startDetailScan, startShopifyAppsCrawl } from "./crawlApps";

// Keeps the App Store data fresh without a manual click. A tick every few minutes decides what is due:
//   - the full read (category tree, every listing) once the last one is a day old: new apps, rating and review changes,
//     apps that moved category. Repeated reads are what let the tab show what changed.
//   - otherwise, while apps are waiting for their page to be read (never read, an older reader, or stale: watched
//     categories after a week, the rest after a month), a batch of app pages. The ~12,000 apps fill in over a day or
//     two of running, then stay current at a trickle.
// Nothing runs on a fresh install (no apps yet): the first read is the "Read App Store" button's.
// The server has to be awake to read: on a free Render instance that sleeps when idle, reads happen while it is up.
const FULL_READ_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_MS = 2 * 60 * 1000; // stale data is read shortly after boot, not during it

// Cached on globalThis so a dev-server hot-reload doesn't start a second parallel scheduler.
const g = globalThis as typeof globalThis & { _shopifyAppsScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean } };
const state = (g._shopifyAppsScheduler ??= { timer: null, started: false });

function scheduleTick(delayMs: number) {
  if (state.timer) clearTimeout(state.timer);
  const timer = setTimeout(tick, Math.max(0, delayMs));
  timer.unref?.();
  state.timer = timer;
}

async function tick() {
  try {
    await connectToDatabase();
    // The last full read is whenever the listings step last touched an app; a manual refresh counts too.
    const latest = await ShopifyApp.findOne().sort({ lastSeenAt: -1 }).select("lastSeenAt").lean<{ lastSeenAt: Date } | null>();
    if (latest) {
      // Both join a read already in progress (e.g. a manual one) rather than starting a parallel one.
      if (Date.now() - latest.lastSeenAt.getTime() >= FULL_READ_INTERVAL_MS) await startShopifyAppsCrawl();
      else if ((await detailBacklog()) > 0) await startDetailScan();
    }
  } catch (err) {
    console.error("[shopifyApps] scheduled read failed:", err);
  }
  scheduleTick(TICK_MS);
}

/** Called once from instrumentation.ts on server boot. */
export async function startShopifyAppsScheduler() {
  if (state.started) return;
  state.started = true;
  scheduleTick(FIRST_TICK_MS);
}
