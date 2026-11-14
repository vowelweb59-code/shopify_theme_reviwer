/**
 * Read-only: is the Theme Status Group sync healthy? Prints the Google Chat connection (status, account, last sync, the newest message
 * it has seen, the last error) and the newest stored reports, so a report that was posted but never arrived can be explained
 * (a revoked connection, a sync that stopped, a read mark ahead of the message).
 *
 *   npx tsx --env-file=.env.production.local scripts/chat-sync-status.ts
 */
import { connectToDatabase } from "../lib/db/connect";
import { ChatConnection } from "../models/chat-connection";
import { ChatReport } from "../models/chat-report";

const when = (d: Date | null | undefined) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "never");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const connections = await ChatConnection.find().lean<{ email?: string; status: string; lastSyncAt?: Date | null; lastMessageAt?: Date | null; lastError?: string | null }[]>();
  if (connections.length === 0) console.log("No Google Chat connection is saved.");
  for (const c of connections) {
    console.log(`Connection ${c.email ?? "?"}: status ${c.status}`);
    console.log(`  last sync:          ${when(c.lastSyncAt)}`);
    console.log(`  newest message seen: ${when(c.lastMessageAt)}`);
    console.log(`  last error:         ${c.lastError ?? "none"}`);
  }
  const newest = await ChatReport.find().sort({ postedAt: -1, date: -1 }).limit(8).select("sender date postedAt themeName status").lean<{ sender: string; date: Date; postedAt?: Date | null; themeName: string; status: string }[]>();
  console.log("\nNewest stored reports:");
  for (const r of newest) console.log(`  posted ${when(r.postedAt)}  report day ${new Date(r.date).toISOString().slice(0, 10)}  ${r.sender || "?"}  "${r.themeName}"  ${r.status}`);
  console.log(`\nNow: ${when(new Date())}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
