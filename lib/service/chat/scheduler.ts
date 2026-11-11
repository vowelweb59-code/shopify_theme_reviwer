import { connectToDatabase } from "@/lib/db/connect";
import { intervalMs } from "@/lib/jobs/intervalMinutes";
import { ServiceChatConnection } from "@/models/service-chat";
import { istDay, istMonth } from "./months";
import { syncServiceMonth } from "./sync";

// Service team (TIMER STATUS) auto sync: this IST month every 15 minutes, and on the first round of each IST day also last
// month (late posts). Skipped while Chat is not connected. Separate from the theme team's lib/chat/scheduler.ts.
const INTERVAL_MS = intervalMs(process.env.SERVICE_CHAT_SYNC_MINUTES, 15);

const g = globalThis as typeof globalThis & { _serviceChatScheduler?: { timer: ReturnType<typeof setTimeout> | null; started: boolean; running: boolean; lastBackfillDay: string } };
const state = (g._serviceChatScheduler ??= { timer: null, started: false, running: false, lastBackfillDay: "" });

async function runOnce() {
  if (state.running) return;
  state.running = true;
  try {
    await connectToDatabase();
    const conn = await ServiceChatConnection.findOne({ key: "service-chat" }).select("status").lean<{ status: string } | null>();
    if (conn?.status === "active") {
      const now = new Date();
      const day = istDay(now);
      const months = [istMonth(now)];
      if (state.lastBackfillDay !== day) months.unshift(istMonth(now, 1));
      for (const m of months) {
        const r = await syncServiceMonth(m, "auto");
        if (r.saved.entriesCreated > 0) console.log(`[service-chat] ${m}: read ${r.fetched} messages, ${r.saved.entriesCreated} new entries`);
      }
      state.lastBackfillDay = day;
    }
  } catch (err) {
    console.error("[service-chat] scheduled sync failed:", err instanceof Error ? err.message : err);
  } finally {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    const timer = setTimeout(() => void runOnce(), INTERVAL_MS);
    timer.unref?.();
    state.timer = timer;
  }
}

/** Called once from instrumentation.ts on server boot. */
export async function startServiceChatScheduler() {
  if (state.started) return;
  state.started = true;
  void runOnce();
}
