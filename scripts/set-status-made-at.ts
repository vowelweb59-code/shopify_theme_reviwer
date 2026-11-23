import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { ServiceProject } from "@/models/service-project";

// Sets the real day a project's latest status change was made (`history[].madeAt`), for a move made by hand before that field existed
// (first case, 2026-11-23, owner: "Claire Park" completed that day; the overview of last week must still show it Active). The change
// keeps its `at` (the last report date); only the day the past-period view uses changes. Audit `project.set_status_made_at`.
// Dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/set-status-made-at.ts "Claire Park" [--on 2026-11-23] [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const onIdx = argv.indexOf("--on");
const on = onIdx >= 0 ? argv[onIdx + 1] : new Date().toISOString().slice(0, 10);
const name = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));

async function main() {
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(on ?? "")) throw new Error('Usage: set-status-made-at.ts "<Project name>" [--on YYYY-MM-DD] [--apply]');
  await connectToDatabase();
  // A name may be the project's name or its client's: match the name as typed, then names that start with it ("Claire Park – Zainab").
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = await ServiceProject.find({ name: new RegExp(`^${esc}( [–-] .*)?$`, "i") })
    .select("name status history")
    .lean<Array<{ _id: string; name: string; status: string; history: Array<{ toStatus: string; at: Date; madeAt?: Date | null }> }>>();
  if (found.length !== 1) throw new Error(`${found.length} projects match "${name}": ${found.map((p) => p.name).join(", ") || "none"}; need exactly one.`);
  const p = found[0]!;
  let idx = -1;
  p.history.forEach((h, i) => {
    if (idx < 0 || +new Date(h.at) >= +new Date(p.history[idx]!.at)) idx = i;
  });
  const last = p.history[idx];
  if (!last) throw new Error(`"${p.name}" has no status history.`);
  const madeAt = new Date(`${on}T06:30:00Z`); // noon IST
  console.log(
    `${apply ? "APPLYING" : "Dry run"}: "${p.name}" (${p.status}) latest change -> ${last.toStatus}, dated ${last.at.toISOString().slice(0, 10)}` +
      ` (last report); made on ${last.madeAt ? last.madeAt.toISOString().slice(0, 10) + " (already set)" : "not recorded"} -> ${on}`
  );
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  await ServiceProject.updateOne({ _id: p._id }, { $set: { [`history.${idx}.madeAt`]: madeAt } });
  await recordServiceAudit("project.set_status_made_at", { projectId: p._id, index: idx, madeAt: on, via: "scripts/set-status-made-at.ts" });
  console.log("Done.");
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
