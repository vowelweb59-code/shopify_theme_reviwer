import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { dmMatch } from "@/lib/service/dm-members";

// Removes a project that does not belong on this site (owner, 2026-11-17: "Thani Almheiri is not a Digital Marketing project"; the
// New Project Update sync made it on 2026-11-16 because a non-team person had reported hours for the name). Removes, for the project
// found by its exact name: the project, its client when it has no other project, the time entries placed on the project or the client
// (including entries shared with other projects), and the Chat messages that only those entries came from. Refuses when a Digital
// Marketing person has reported on it unless --include-dm. Logged in the Service audit log (project.remove).
//
// A dry run unless --apply (the owner runs it; it writes to the live database):
//   npx tsx --env-file=.env.production.local scripts/service-remove-project.ts "Thani Almheiri" [--include-dm] [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const includeDm = argv.includes("--include-dm");
const name = argv.find((a) => !a.startsWith("--"));

async function main() {
  if (!name) throw new Error('Usage: service-remove-project.ts "<Project name>" [--include-dm] [--apply]');
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const projects = await db.collection("service_projects").find({ name }).toArray();
  if (projects.length !== 1) throw new Error(`${projects.length} projects are named "${name}"; need exactly one.`);
  const p = projects[0];
  const clientId = p.clientId as string | null;
  const otherProjects = clientId ? await db.collection("service_projects").countDocuments({ clientId, _id: { $ne: p._id } } as never) : 0;
  const client = clientId ? await db.collection("service_clients").findOne({ _id: clientId } as never) : null;

  const entries = await db.collection("service_time_entries").find({ $or: [{ projectId: p._id }, { "allocations.projectId": p._id }, ...(clientId && !otherProjects ? [{ clientId }] : [])] } as never).toArray();
  const senders = await db.collection("service_chat_senders").find({ externalId: { $in: [...new Set(entries.map((e) => e.senderExternalId as string))] } }).toArray();
  const senderName = new Map(senders.map((s) => [s.externalId as string, s.displayName as string]));
  const by = new Map<string, { n: number; min: number }>();
  for (const e of entries) {
    const n = senderName.get(e.senderExternalId as string) ?? "Unknown";
    const t = by.get(n) ?? { n: 0, min: 0 };
    t.n++; t.min += e.minutes as number; by.set(n, t);
  }
  const dmPeople = [...by.keys()].filter((n) => dmMatch(n) !== null);

  console.log(`${apply ? "APPLYING" : "Dry run"}: remove project "${p.name}" (${p.status}, made ${p.createdAt?.toISOString?.().slice(0, 10)}, contractRef ${p.contractRef ?? "none"})`);
  console.log(`  Client "${client?.name ?? "none"}": ${otherProjects ? `kept, it has ${otherProjects} other project(s)` : "will be removed too"}`);
  console.log(`  Entries to remove: ${entries.length} (${(entries.reduce((n, e) => n + (e.minutes as number), 0) / 60).toFixed(1)} h)`);
  for (const [n, t] of by) console.log(`    ${n}${dmMatch(n) ? "  [Digital Marketing]" : ""}: ${t.n} entries, ${(t.min / 60).toFixed(1)} h`);
  if (dmPeople.length && !includeDm) throw new Error(`Digital Marketing people have hours on it (${dmPeople.join(", ")}). Add --include-dm if it really must go.`);

  const ids = entries.map((e) => e._id);
  const sourceIds = new Set(entries.flatMap((e) => [e.sourceMessageId, e.startMessageId].filter(Boolean) as string[]));
  const stillNeeded = new Set(
    (await db.collection("service_time_entries").find({ _id: { $nin: ids }, $or: [{ sourceMessageId: { $in: [...sourceIds] } }, { startMessageId: { $in: [...sourceIds] } }] } as never).toArray())
      .flatMap((e) => [e.sourceMessageId, e.startMessageId].filter(Boolean) as string[]),
  );
  const messageIds = [...sourceIds].filter((m) => !stillNeeded.has(m));
  console.log(`  Chat messages to remove: ${messageIds.length} (${stillNeeded.size} kept: other entries still use them)`);
  if (!apply) return console.log("Nothing written. Add --apply to remove.");

  await db.collection("service_time_entries").deleteMany({ _id: { $in: ids } } as never);
  if (messageIds.length) await db.collection("service_chat_messages").deleteMany({ _id: { $in: messageIds } } as never);
  await db.collection("service_projects").deleteOne({ _id: p._id });
  if (client && !otherProjects) await db.collection("service_clients").deleteOne({ _id: client._id } as never);
  await recordServiceAudit("project.remove", { projectId: p._id, name: p.name, entries: entries.length, client: !otherProjects ? client?.name ?? null : null, via: "scripts/service-remove-project.ts" });
  console.log("Done.");
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
