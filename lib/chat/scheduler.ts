import { connectToDatabase } from "@/lib/db/connect";
import { ChatConnection } from "@/models/chat-connection";
import { syncSpace } from "./syncSpace";

// Reads the Theme Status Group's new time reports every day at 9:00 PM IST (15:30 UTC; India has no daylight saving).
// A fixed clock time, unlike the crawl schedulers' jittered ones, because the team posts their reports through the day.
// A server that was down at 9 PM catches up on boot: if nothing has synced since the last 9 PM slot, it syncs right away.
const SLOT_UTC_HOUR = 15;
const SLOT_UTC_MINUTE = 30;

const globalForScheduler = globalThis as typeof globalThis & { _chatSyncScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean } };
const state = (globalForScheduler._chatSyncScheduler ??= { timer: null, started: false });

/** The most recent 9 PM IST at or before `now`. */
function lastSlot(now: Date): Date {
  const slot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SLOT_UTC_HOUR, SLOT_UTC_MINUTE));
  return slot > now ? new Date(slot.getTime() - 24 * 60 * 60 * 1000) : slot;
}

async function runOnce() {
  try {
    await connectToDatabase();
    const summary = await syncSpace();
    console.log(`[chat-sync] read ${summary.fetched} messages, ${summary.reports} reports: imported ${summary.created}`);
  } catch (err) {
    console.error("[chat-sync] scheduled sync failed:", err instanceof Error ? err.message : err);
  }
  scheduleNext();
}

function scheduleNext() {
  if (state.timer) clearTimeout(state.timer);
  const next = new Date(lastSlot(new Date()).getTime() + 24 * 60 * 60 * 1000);
  const timer = setTimeout(() => void runOnce(), Math.max(0, next.getTime() - Date.now()));
  timer.unref?.();
  state.timer = timer;
}

/** Called once from instrumentation.ts on server boot. */
export async function startChatSyncScheduler() {
  if (state.started) return;
  state.started = true;

  await connectToDatabase();
  const connection = await ChatConnection.findOne({ key: "chat" }).select("status lastSyncAt").lean<{ status: string; lastSyncAt?: Date | null } | null>();
  if (connection?.status === "active" && (!connection.lastSyncAt || connection.lastSyncAt < lastSlot(new Date()))) void runOnce();
  else scheduleNext();
}
