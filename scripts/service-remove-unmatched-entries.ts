import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { dmMatch } from "@/lib/service/dm-members";

// Removes hours waiting in Review with NO client whose client field matches a pattern, plus the Chat messages only those entries came
// from (first case, 2026-11-18, owner: "Remove Hajra": the hours written "Hajara Hussain | Direct (Summur)" and its spellings are not
// Digital Marketing work). Only entries with no client are touched, so a matched client's hours are never removed here. Refuses when a
// Digital Marketing person posted any of them unless --include-dm. Audit `entries.remove_unmatched`.
// Dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/service-remove-unmatched-entries.ts "<regex>" [--include-dm] [--apply]
//   e.g. "hajar?a? hus+ain|summur"
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const includeDm = argv.includes("--include-dm");
const pattern = argv.find((a) => !a.startsWith("--"));

async function main() {
  if (!pattern) throw new Error('Usage: service-remove-unmatched-entries.ts "<regex>" [--include-dm] [--apply]');
  const re = new RegExp(pattern, "i");
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const all = await db.collection("service_time_entries").find({ clientId: null, clientRaw: { $ne: null } } as never).toArray();
  const entries = all.filter((e) => re.test(String(e.clientRaw)));
  const senders = await db.collection("service_chat_senders").find({ externalId: { $in: [...new Set(entries.map((e) => e.senderExternalId as string))] } }).toArray();
  const senderName = new Map(senders.map((s) => [s.externalId as string, s.displayName as string]));
  const names = new Map<string, { n: number; min: number }>();
  const people = new Map<string, number>();
  for (const e of entries) {
    const k = String(e.clientRaw).trim();
    const t = names.get(k) ?? { n: 0, min: 0 };
    t.n++; t.min += e.minutes as number; names.set(k, t);
    const who = senderName.get(e.senderExternalId as string) ?? "Unknown";
    people.set(who, (people.get(who) ?? 0) + (e.minutes as number));
  }
  console.log(`${apply ? "APPLYING" : "Dry run"}: entries with no client matching /${pattern}/i: ${entries.length} (${(entries.reduce((n, e) => n + (e.minutes as number), 0) / 60).toFixed(1)} h)`);
  for (const [k, t] of names) console.log(`  "${k}": ${t.n} entries, ${(t.min / 60).toFixed(1)} h`);
  console.log(`  Posted by: ${[...people].map(([n, m]) => `${n}${dmMatch(n) ? " [DM]" : ""} ${(m / 60).toFixed(1)} h`).join(", ") || "nobody"}`);
  const dm = [...people.keys()].filter((n) => dmMatch(n) !== null);
  if (dm.length && !includeDm) throw new Error(`Digital Marketing people posted some of them (${dm.join(", ")}). Add --include-dm if they must go.`);

  const ids = entries.map((e) => e._id);
  const sourceIds = new Set(entries.flatMap((e) => [e.sourceMessageId, e.startMessageId].filter(Boolean) as string[]));
  const stillNeeded = new Set(
    (await db.collection("service_time_entries").find({ _id: { $nin: ids }, $or: [{ sourceMessageId: { $in: [...sourceIds] } }, { startMessageId: { $in: [...sourceIds] } }] } as never).toArray())
      .flatMap((e) => [e.sourceMessageId, e.startMessageId].filter(Boolean) as string[]),
  );
  const messageIds = [...sourceIds].filter((m) => !stillNeeded.has(m));
  console.log(`  Chat messages to remove: ${messageIds.length} (${stillNeeded.size} kept: other entries still use them)`);
  if (!apply) return console.log("Nothing written. Add --apply to remove.");

  if (ids.length) await db.collection("service_time_entries").deleteMany({ _id: { $in: ids } } as never);
  if (messageIds.length) await db.collection("service_chat_messages").deleteMany({ _id: { $in: messageIds } } as never);
  await recordServiceAudit("entries.remove_unmatched", { pattern, entries: entries.length, via: "scripts/service-remove-unmatched-entries.ts" });
  console.log("Done.");
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
