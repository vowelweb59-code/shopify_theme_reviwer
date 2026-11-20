import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { HOLD_UNTIL_TEAM_REASON } from "@/lib/service/projects/activity-rules";
import { dateForManualMove } from "@/lib/service/projects/manual-date";
import { ServiceProject } from "@/models/service-project";

// Puts a Service project On hold until a Digital Marketing team member reports on it (owner, 2026-11-17: "Gary Mcnelley - Farida").
// The next sync after a team report dated after today puts it back to Active (`applyActivityRules`). Dry run unless --apply (owner runs it):
//   npx tsx --env-file=.env.production.local scripts/service-hold-project.ts "<Project name>" [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const name = argv.find((a) => !a.startsWith("--"));

async function main() {
  if (!name) throw new Error('Usage: service-hold-project.ts "<Project name>" [--apply]');
  await connectToDatabase();
  const found = await ServiceProject.find({ name }).select("name status clientId history").lean<Array<{ _id: string; name: string; status: string; clientId: string | null; history: Array<{ at: Date }> }>>();
  if (found.length !== 1) throw new Error(`${found.length} projects are named "${name}"; need exactly one.`);
  const p = found[0];
  if (p.status !== "ACTIVE") throw new Error(`"${p.name}" is ${p.status}, not ACTIVE.`);
  console.log(`${apply ? "APPLYING" : "Dry run"}: "${p.name}" ACTIVE -> ON_HOLD (${HOLD_UNTIL_TEAM_REASON})`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  await ServiceProject.updateOne({ _id: p._id, status: "ACTIVE" }, { $set: { status: "ON_HOLD" }, $push: { history: { fromStatus: "ACTIVE", toStatus: "ON_HOLD", reason: HOLD_UNTIL_TEAM_REASON, at: await dateForManualMove("ON_HOLD", p) } } }); // dated the last report (owner, 2026-11-20)
  await recordServiceAudit("project.hold", { projectId: p._id, via: "scripts/service-hold-project.ts" });
  console.log("Done.");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
