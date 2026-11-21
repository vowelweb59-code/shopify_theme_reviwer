import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { dateForManualMove } from "@/lib/service/projects/manual-date";
import { validateTransition } from "@/lib/service/projects/transitions";
import { ServiceProject } from "@/models/service-project";

// Moves a Service project to another status by hand, with a reason in its history (first case, 2026-11-18, owner: "Morten – WordPress":
// the Digital Marketing work ended, only app teams work on it, so it is closed and will come back only if one of the marketing team logs
// hours on it). Only a move the status rules allow. Audit `project.set_status`. Dry run unless --apply (the owner runs it):
//   npx tsx --env-file=.env.production.local scripts/service-set-project-status.ts "<Project name>" --to COMPLETED --reason "<why>" [--apply]
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const name = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));

async function main() {
  const to = flag("to");
  const reason = flag("reason");
  if (!name || !to || !reason) throw new Error('Usage: service-set-project-status.ts "<Project name>" --to COMPLETED --reason "<why>" [--apply]');
  await connectToDatabase();
  const found = await ServiceProject.find({ name })
    .select("name status clientId history")
    .lean<Array<{ _id: string; name: string; status: string; clientId: string | null; history: Array<{ at: Date }> }>>();
  if (found.length !== 1) throw new Error(`${found.length} projects are named "${name}"; need exactly one.`);
  const p = found[0]!;
  const ok = validateTransition(p.status as never, to as never, reason);
  if (!ok.ok) throw new Error(`${p.status} -> ${to} is not allowed: ${ok.error}`);
  console.log(`${apply ? "APPLYING" : "Dry run"}: "${p.name}" ${p.status} -> ${to} (${reason})`);
  if (!apply) return console.log("Nothing written. Add --apply to save it.");
  // Dated the project's last report when completing or holding it (owner, 2026-11-20).
  const at = await dateForManualMove(to, p);
  await ServiceProject.updateOne(
    { _id: p._id, status: p.status },
    { $set: { status: to }, $push: { history: { fromStatus: p.status, toStatus: to, reason, at } } }
  );
  await recordServiceAudit("project.set_status", { projectId: p._id, from: p.status, to, via: "scripts/service-set-project-status.ts" });
  console.log("Done.");
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
