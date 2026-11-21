import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { dmMatch } from "@/lib/service/dm-members";

// Removes several projects that are not Digital Marketing work (owner, 2026-11-18, the Direct list: "Kutaisi Airport car rental doesn't
// exist", "Siddhant Joshi, not my project", "rest are not my project"). The same rules as service-remove-project.ts, once per name: for
// each project found by its exact name, the project, its client when it has no other project, the time entries placed on the project
// or the client, and the Chat messages only those entries came from. Refuses (touches nothing) when a Digital Marketing person has hours
// on any of them unless --include-dm. Audit `project.remove`, one record per project.
// Dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/service-remove-projects.ts [--include-dm] [--apply]
const NAMES = ["Kutaisi Airport Car Rental", "Siddhant Doshi(Dreamzhub)", "Sandra Rouse", "Jay Hwang", "Nes (Stellar Vloeren)", "Lily Odogwu", "Carl Martin"];
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const includeDm = argv.includes("--include-dm");

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;
  console.log(apply ? "APPLYING:" : "Dry run:");
  const plans: Array<{
    p: Record<string, unknown>;
    client: Record<string, unknown> | null;
    otherProjects: number;
    ids: unknown[];
    messageIds: string[];
    entries: number;
  }> = [];
  const dmBlocked: string[] = [];
  for (const name of NAMES) {
    const found = await db.collection("service_projects").find({ name }).toArray();
    if (found.length !== 1) {
      console.log(`  ${name}: ${found.length} projects match; skipped`);
      continue;
    }
    const p = found[0]!;
    const clientId = p.clientId as string | null;
    const otherProjects = clientId ? await db.collection("service_projects").countDocuments({ clientId, _id: { $ne: p._id } } as never) : 0;
    const client = clientId ? await db.collection("service_clients").findOne({ _id: clientId } as never) : null;
    const entries = await db
      .collection("service_time_entries")
      .find({ $or: [{ projectId: p._id }, { "allocations.projectId": p._id }, ...(clientId && !otherProjects ? [{ clientId }] : [])] } as never)
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
    if (dmPeople.length) dmBlocked.push(name);
    console.log(
      `  ${name} [${p.status}]: ${entries.length} entries (${(entries.reduce((n, e) => n + (e.minutes as number), 0) / 60).toFixed(1)} h) by ${[...by].map(([n, t]) => `${n}${dmMatch(n) ? " [DM]" : ""} ${(t.min / 60).toFixed(1)} h`).join(", ") || "nobody"}; client ${otherProjects ? "kept (other projects)" : client ? "removed too" : "none"}`
    );

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
    plans.push({ p, client, otherProjects, ids, messageIds: [...sourceIds].filter((m) => !stillNeeded.has(m)), entries: entries.length });
  }
  if (dmBlocked.length && !includeDm)
    throw new Error(`Digital Marketing people have hours on: ${dmBlocked.join(", ")}. Nothing was changed. Add --include-dm if they must all go.`);
  console.log(
    `  Total: ${plans.length} projects, ${plans.reduce((n, x) => n + x.entries, 0)} entries, ${plans.reduce((n, x) => n + x.messageIds.length, 0)} Chat messages.`
  );
  if (!apply) return console.log("Nothing written. Add --apply to remove.");

  for (const x of plans) {
    if (x.ids.length) await db.collection("service_time_entries").deleteMany({ _id: { $in: x.ids } } as never);
    if (x.messageIds.length) await db.collection("service_chat_messages").deleteMany({ _id: { $in: x.messageIds } } as never);
    await db.collection("service_projects").deleteOne({ _id: x.p._id } as never);
    if (x.client && !x.otherProjects) await db.collection("service_clients").deleteOne({ _id: x.client._id } as never);
    await recordServiceAudit("project.remove", {
      projectId: x.p._id,
      name: x.p.name,
      entries: x.entries,
      client: !x.otherProjects ? ((x.client?.name as string | undefined) ?? null) : null,
      via: "scripts/service-remove-projects.ts",
    });
  }
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
