import { connectToDatabase } from "@/lib/db/connect";
import { intervalMs } from "@/lib/jobs/intervalMinutes";
import { createRepeatingJob } from "@/lib/jobs/repeatingJob";
import { ServiceChatConnection } from "@/models/service-chat";
import { istDay, istMonth } from "./months";
import { newestServiceMessage, serviceChatSpace } from "./google";
import { serviceRefreshToken, syncServiceMonth } from "./sync";

// Service team (TIMER STATUS) auto sync: this IST month every 15 minutes, and on the first round of each IST day also last
// month (late posts). Skipped while Chat is not connected. Separate from the theme team's lib/chat/scheduler.ts.
const INTERVAL_MS = intervalMs(process.env.SERVICE_CHAT_SYNC_MINUTES, 15);

let lastBackfillDay = "";

/** Called once from instrumentation.ts on server boot. */
export const startServiceChatScheduler = createRepeatingJob("service-chat-sync", "service-chat", INTERVAL_MS, async () => {
  await connectToDatabase();
  const conn = await ServiceChatConnection.findOne({ key: "service-chat" }).select("status").lean<{ status: string } | null>();
  if (conn?.status !== "active") return;
  const now = new Date();
  const day = istDay(now);
  const months = [istMonth(now)];
  if (lastBackfillDay !== day) months.unshift(istMonth(now, 1));
  for (const m of months) {
    const r = await syncServiceMonth(m, "auto");
    if (r.saved.entriesCreated > 0) console.log(`[service-chat] ${m}: read ${r.fetched} messages, ${r.saved.entriesCreated} new entries`);
  }
  lastBackfillDay = day;
});

// Owner, 2026-11-16: reports should update as soon as someone posts in TIMER STATUS. Google Chat can only push to a Chat app or
// Pub/Sub, so instead every minute (SERVICE_CHAT_WATCH_MINUTES) one small request asks for the newest message; when it differs from
// the last one seen, this month is synced at once. Edits are still caught by the 15-minute sync above. Only while the server is
// awake (a sleeping free Render instance checks nothing).
const WATCH_MS = intervalMs(process.env.SERVICE_CHAT_WATCH_MINUTES, 1);
const watch = globalThis as typeof globalThis & { _serviceChatNewest?: string | null };

export const startServiceChatWatcher = createRepeatingJob("service-chat-watch", "service-chat-watch", WATCH_MS, async () => {
  await connectToDatabase();
  const conn = await ServiceChatConnection.findOne({ key: "service-chat" }).select("status").lean<{ status: string } | null>();
  if (conn?.status !== "active") return;
  const newest = await newestServiceMessage(await serviceRefreshToken(), serviceChatSpace());
  if (watch._serviceChatNewest === undefined) {
    watch._serviceChatNewest = newest; // first look after boot: the 15-minute job's boot run reads the month anyway
    return;
  }
  if (newest === watch._serviceChatNewest) return;
  const month = istMonth(new Date());
  const r = await syncServiceMonth(month, "auto"); // throws "already running" -> the mark stays, so the next minute retries
  watch._serviceChatNewest = newest;
  console.log(`[service-chat-watch] new message: ${month} read ${r.fetched} messages, ${r.saved.entriesCreated} new entries`);
});
