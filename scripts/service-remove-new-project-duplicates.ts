// Removes projects the New Project Update sync made (contractRef "chat:...") when the same client already has another open project
// and the new one has no hours. Of several open projects of a client, one NOT made from Chat is kept, else the earliest start.
// Also removes projects (and their client) the sync made for clients that are not Digital Marketing: the client was created by the sync
// itself (same minute as the project) and no hours exist for it, by client or by the name written in a report.
// Dry run by default; the owner runs --apply. Each removal is logged in the Service audit log (service.remove_new_project_duplicate).
//   npx tsx --env-file=.env.production.local scripts/service-remove-new-project-duplicates.ts [--apply]
import mongoose from "mongoose";

const OPEN = ["NOT_STARTED", "ACTIVE", "BLOCKED", "WAITING_FOR_CLIENT", "ON_HOLD"];
const apply = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const projects = db.collection("service_projects");
  const made = await projects.find({ contractRef: /^chat:/, status: { $in: OPEN } }).toArray();
  const remove: typeof made = [];
  for (const p of made) {
    const open = await projects.find({ clientId: p.clientId, status: { $in: OPEN } }).toArray();
    if (open.length < 2) continue;
    const keep = open.find((o) => !String(o.contractRef ?? "").startsWith("chat:")) ?? [...open].sort((a, b) => +new Date(a.startDate ?? a.createdAt) - +new Date(b.startDate ?? b.createdAt))[0];
    if (keep._id === p._id) continue;
    const entries = await db.collection("service_time_entries").countDocuments({ $or: [{ projectId: p._id }, { "allocations.projectId": p._id }] });
    console.log(`${apply ? "REMOVE" : "would remove"}: ${p.name} (${p.status}, start ${p.startDate?.toISOString().slice(0, 10)}, ${entries} entries); keeping "${keep.name}" (${keep.status})`);
    if (entries === 0) remove.push(p);
    else console.log("  skipped: it has hours");
  }
  const key = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const reported = new Set(((await db.collection("service_time_entries").distinct("clientRaw", { clientRaw: { $ne: null } })) as string[]).map((r) => key(r.split("|")[0])));
  const removeClients: unknown[] = [];
  for (const p of await projects.find({ contractRef: /^chat:/ }).toArray()) {
    if (remove.some((r) => r._id === p._id)) continue;
    const c = await db.collection("service_clients").findOne({ _id: p.clientId });
    if (!c || Math.abs(+new Date(c.createdAt) - +new Date(p.createdAt)) > 5 * 60_000) continue;
    const hours = await db.collection("service_time_entries").countDocuments({ $or: [{ clientId: c._id }, { projectId: p._id }, { "allocations.projectId": p._id }] });
    if (hours || reported.has(key(c.name))) continue;
    console.log(`${apply ? "REMOVE" : "would remove"}: ${p.name} (${p.status}) and its client "${c.name}": made by the sync, no team hours reported for it`);
    remove.push(p);
    removeClients.push(c._id);
  }
  if (apply) for (const id of removeClients) await db.collection("service_clients").deleteOne({ _id: id } as never);
  if (apply) for (const p of remove) await projects.deleteOne({ _id: p._id });
  if (apply && remove.length) console.log("Removed", remove.length, "(not written to the audit log: this is a plain script).");
  if (!apply) console.log(`\nDry run: ${remove.length} would be removed. Add --apply to remove.`);
  process.exit(0);
}
main();
