import { connectToDatabase } from "@/lib/db/connect";
import { ShopifyPartner } from "@/models/shopify-partner";
import { partnerDetailsBacklog, partnerCrawlRunning, startPartnerCrawl, startPartnerDetails } from "./crawlPartners";

// Keeps the Partner Directory pool (Demo Store > Potential Affiliates) current without a click (owner 2026-11-19: the full fetch is a
// one-time job, then it re-syncs every month). A tick every few hours decides what is due:
//   - the listing read of every country (partners, ratings, tiers) once the last one is 30 days old;
//   - otherwise, while profiles wait for their contact details (never read, or read over 30 days ago), the details step. It is
//     resumable, so the first full pass (about two hours for ~5,300 partners) continues over the next ticks if the server restarts.
// Nothing runs on a fresh install (no partners yet): the first listing read is the "Collect partners" button's.
// The server has to be awake to read: on a free Render instance that sleeps when idle, reads happen while it is up.
const REFRESH_DAYS = 30;
const TICK_MS = 3 * 60 * 60 * 1000;
const FIRST_TICK_MS = 4 * 60 * 1000;

const g = globalThis as typeof globalThis & { _partnerScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean } };
const state = (g._partnerScheduler ??= { timer: null, started: false });

function scheduleTick(delayMs: number) {
  if (state.timer) clearTimeout(state.timer);
  const timer = setTimeout(tick, Math.max(0, delayMs));
  timer.unref?.();
  state.timer = timer;
}

async function tick() {
  try {
    await connectToDatabase();
    if (!partnerCrawlRunning()) {
      const latest = await ShopifyPartner.findOne().sort({ lastSeenAt: -1 }).select("lastSeenAt").lean<{ lastSeenAt: Date } | null>();
      if (latest) {
        if (Date.now() - latest.lastSeenAt.getTime() >= REFRESH_DAYS * 86_400_000) startPartnerCrawl();
        else if ((await partnerDetailsBacklog(REFRESH_DAYS)) > 0) startPartnerDetails({ refreshAfterDays: REFRESH_DAYS });
      }
    }
  } catch (err) {
    console.error("[partners] scheduled read failed:", err);
  }
  scheduleTick(TICK_MS);
}

/** Called once from instrumentation.ts on server boot. */
export async function startPartnerScheduler() {
  if (state.started) return;
  state.started = true;
  scheduleTick(FIRST_TICK_MS);
}
