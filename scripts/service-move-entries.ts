import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Moves the hours of one project onto another project of the same client from a date on (first case, 2026-11-17: "Andrew Johnson" got a
// second project for new work, but the auto-placement put the November hours on the old, completed one because both use the same Upwork
// profile). Only plain entries (not split ones), not rejected, dated on or after --since. A dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/service-move-entries.ts --from "<Project>" --to "<Project>" --since YYYY-MM-DD [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const flag = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };

async function one(name: string) {
  const f = await ServiceProject.find({ name }).select("name clientId").lean<Array<{ _id: string; name: string; clientId: string | null }>>();
  if (f.length !== 1) throw new Error(`${f.length} projects are named "${name}"; need exactly one.`);
  return f[0];
}

async function main() {
  const from = flag("from"), to = flag("to"), since = flag("since");
  if (!from || !to || !since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('Usage: service-move-entries.ts --from "<Project>" --to "<Project>" --since YYYY-MM-DD [--apply]');
  await connectToDatabase();
  const a = await one(from), b = await one(to);
  if (a.clientId !== b.clientId) throw new Error("The two projects belong to different clients; refusing.");
  const names = new Map((await ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>()).map((s) => [s.externalId, s.displayName]));
  const rows = await ServiceTimeEntry.find({ projectId: a._id, state: { $ne: "REJECTED" }, entryDate: { $gte: new Date(`${since}T00:00:00Z`) } }).select("minutes entryDate senderExternalId").lean<Array<{ _id: string; minutes: number; entryDate: Date; senderExternalId: string }>>();
  console.log(`${apply ? "APPLYING" : "Dry run"}: ${rows.length} entries (${(rows.reduce((n, r) => n + r.minutes, 0) / 60).toFixed(1)} h) from "${a.name}" to "${b.name}"`);
  for (const r of rows) console.log(`  ${r.entryDate.toISOString().slice(0, 10)}  ${r.minutes} min  ${names.get(r.senderExternalId) ?? r.senderExternalId}`);
  if (!apply) return console.log("Nothing written. Add --apply to move them.");
  if (!rows.length) return;
  await ServiceTimeEntry.updateMany({ _id: { $in: rows.map((r) => r._id) } }, { $set: { projectId: b._id } });
  await recordServiceAudit("entries.move", { from: a._id, to: b._id, count: rows.length, since, via: "scripts/service-move-entries.ts" });
  console.log("Done.");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
