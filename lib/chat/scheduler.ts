import { connectToDatabase } from "@/lib/db/connect";
import { createRepeatingJob } from "@/lib/jobs/repeatingJob";
import { ChatConnection } from "@/models/chat-connection";
import { syncSpace } from "./syncSpace";

// Reads the Theme Status Group's new time reports every 5 minutes, so the Current Work page follows the group (and the
// 9:00 PM IST end-of-day reports are in well before anyone looks). Only messages newer than the last sync are fetched,
// so a run with nothing new is one cheap list call. A run that finds Google Chat not connected is skipped.
const INTERVAL_MS = 5 * 60 * 1000;

/** Called once from instrumentation.ts on server boot. Syncs right away, then every 5 minutes. */
export const startChatSyncScheduler = createRepeatingJob("chat-sync", "chat-sync", INTERVAL_MS, async () => {
  await connectToDatabase();
  const connection = await ChatConnection.findOne({ key: "chat" }).select("status").lean<{ status: string } | null>();
  if (connection?.status === "active") {
    const summary = await syncSpace();
    if (summary.created > 0) console.log(`[chat-sync] read ${summary.fetched} messages: imported ${summary.created} reports`);
  }
});
