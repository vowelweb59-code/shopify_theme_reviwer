import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { dmMatch } from "@/lib/service/dm-members";

// Robert Lewis (owner, 2026-11-18): the client is Robert Lewis (Shraddha profile). "Robert Reckley | Adnan" (74.5 h, all by Pranay) is an
// app client, not marketing work, so those entries do not belong here. The client used to be called "Robert", and the importer treats a
// client name written whole inside the field as a match, so "Robert Reckley" and "S Robert" kept landing on it. This script
//   1. takes the alias "Robert" off the client "Robert Lewis" (it would pull them in again on the next Chat read),
//   2. removes the entries of that client written "Robert Reckley" or "S Robert", and the Chat messages only those entries came from.
// It refuses when a Digital Marketing person posted any of them, unless --include-dm.
// Dry run unless --apply (the owner runs it); audit `client.fix_robert_lewis`.
//   npx tsx --env-file=.env.production.local scripts/fix-robert-lewis.ts [--include-dm] [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const includeDm = argv.includes("--include-dm");

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const clients = await db.collection("service_clients").find({ name: "Robert Lewis" }).toArray();
  if (clients.length !== 1) throw new Error(`${clients.length} clients are named "Robert Lewis"; need exactly one.`);
  const client = clients[0]!;
  const hasAlias = ((client.aliases as string[]) ?? []).includes("Robert");

  const entries = await db
    .collection("service_time_entries")
    .find({ clientId: client._id, clientRaw: /reckley|^\s*s robert(?![a-z])/i } as never)
    .toArray();
  const senders = await db
    .collection("service_chat_senders")
    .find({ externalId: { $in: [...new Set(entries.map((e) => e.senderExternalId as string))] } })
    .toArray();
  const senderName = new Map(senders.map((s) => [s.externalId as string, s.displayName as string]));
  const by = new Map<string, { n: number; min: number }>();
  for (const e of entries) {
    const n = senderName.get(e.senderExternalId as string) ?? "Unknown";
    const t = by.get(n) ?? { n: 0, min: 0 };
    t.n++;
    t.min += e.minutes as number;
    by.set(n, t);
  }
  const dmPeople = [...by.keys()].filter((n) => dmMatch(n) !== null);

  console.log(`${apply ? "APPLYING" : "Dry run"}: client "Robert Lewis"`);
  console.log(`  Alias "Robert": ${hasAlias ? "will be removed" : "not present"}`);
  console.log(
    `  Entries written "Robert Reckley" or "S Robert": ${entries.length} (${(entries.reduce((n, e) => n + (e.minutes as number), 0) / 60).toFixed(1)} h) will be removed`
  );
  for (const [n, t] of by) console.log(`    ${n}${dmMatch(n) ? "  [Digital Marketing]" : ""}: ${t.n} entries, ${(t.min / 60).toFixed(1)} h`);
  if (dmPeople.length && !includeDm)
    throw new Error(`Digital Marketing people posted some of them (${dmPeople.join(", ")}). Add --include-dm if they must go too.`);

  const ids = entries.map((e) => e._id);
  const sourceIds = new Set(entries.flatMap((e) => [e.sourceMessageId, e.startMessageId].filter(Boolean) as string[]));
  const stillNeeded = new Set(
    (
      await db
        .collection("service_time_entries")
        .find({ _id: { $nin: ids }, $or: [{ sourceMessageId: { $in: [...sourceIds] } }, { startMessageId: { $in: [...sourceIds] } }] } as never)
        .toArray()
    ).flatMap((e) => [e.sourceMessageId, e.startMessageId].filter(Boolean) as string[])
  );
  const messageIds = [...sourceIds].filter((m) => !stillNeeded.has(m));
  console.log(`  Chat messages to remove: ${messageIds.length} (${stillNeeded.size} kept: other entries still use them)`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");

  if (ids.length) await db.collection("service_time_entries").deleteMany({ _id: { $in: ids } } as never);
  if (messageIds.length) await db.collection("service_chat_messages").deleteMany({ _id: { $in: messageIds } } as never);
  if (hasAlias) await db.collection("service_clients").updateOne({ _id: client._id } as never, { $pull: { aliases: "Robert" } } as never);
  await recordServiceAudit("client.fix_robert_lewis", {
    clientId: String(client._id),
    entries: entries.length,
    aliasRemoved: hasAlias,
    via: "scripts/fix-robert-lewis.ts",
  });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
