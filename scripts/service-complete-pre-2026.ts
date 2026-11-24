import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { loadAllTimeEntries } from "@/lib/service/hours/all-time";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { dateForManualMove } from "@/lib/service/projects/manual-date";
import { ServiceProject } from "@/models/service-project";

// Completes every open project that had no work in the year (owner, 2026-11-24: "you can complete all the projects before 2026 ... only
// projects with no work in 2026"). Work = any reported hours dated from 1 Jan of the year up to today, by anyone, placed on the project the
// usual way. Not started projects are left alone (they have their own tab). Each move is dated the project's last report like every manual
// completion. Dry run unless --apply (the owner runs it); audit `projects.complete_no_work`:
//   npx tsx --env-file=.env.production.local scripts/service-complete-pre-2026.ts [--year 2026] [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const yi = argv.indexOf("--year");
const year = yi >= 0 ? Number(argv[yi + 1]) : 2026;
const REASON = `No work in ${year}`;

async function main() {
  await connectToDatabase();
  const now = new Date();
  const from = new Date(`${year}-01-01T00:00:00Z`);
  const att = await loadAttribution();
  const worked = new Set<string>();
  for (const e of expandAllocations(await loadAllTimeEntries())) {
    if (e.entryDate < from || e.entryDate > now) continue;
    const pid = projectOf(e, att.owner);
    if (pid) worked.add(pid);
  }
  const open = await ServiceProject.find({ status: { $in: ["ACTIVE", "ON_HOLD", "BLOCKED", "WAITING_FOR_CLIENT", "PARTIAL_HOLD"] } })
    .select("name status clientId history")
    .lean<Array<{ _id: string; name: string; status: string; clientId: string | null; history: Array<{ at: Date }> }>>();
  const todo = open.filter((p) => !worked.has(p._id));
  console.log(`${apply ? "APPLYING" : "Dry run"}: ${todo.length} of ${open.length} open projects have no work in ${year}.`);
  for (const p of todo) {
    const at = await dateForManualMove("COMPLETED", p);
    console.log(`  ${p.name} [${p.status}] -> COMPLETED, dated ${at.toISOString().slice(0, 10)}`);
    if (!apply) continue;
    await ServiceProject.updateOne(
      { _id: p._id, status: p.status },
      { $set: { status: "COMPLETED" }, $push: { history: { fromStatus: p.status, toStatus: "COMPLETED", reason: REASON, at, madeAt: new Date() } } }
    );
    await recordServiceAudit("projects.complete_no_work", { projectId: p._id, from: p.status, year });
  }
  if (!apply) console.log("Nothing written. Add --apply to save it.");
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
