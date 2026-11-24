import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { NOT_STARTED_HOLD_REASON } from "@/lib/service/projects/activity-rules";
import { ServiceProject } from "@/models/service-project";

// Puts back to Not started the projects an earlier automatic rule moved to On hold because the team worked on them (owner, 2026-11-24:
// "keep Not started projects in the Not started tab"). Only a project whose newest status change is that automatic hold. Dry run unless --apply:
//   npx tsx --env-file=.env.production.local scripts/service-restore-not-started.ts [--apply]
const apply = process.argv.includes("--apply");

async function main() {
  await connectToDatabase();
  const held = await ServiceProject.find({ status: "ON_HOLD", "history.reason": NOT_STARTED_HOLD_REASON })
    .select("name history")
    .lean<Array<{ _id: string; name: string; history: Array<{ reason: string | null; at: Date }> }>>();
  const now = new Date();
  for (const p of held) {
    const latest = [...p.history].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
    if (latest?.reason !== NOT_STARTED_HOLD_REASON) {
      console.log(`skip (changed since): ${p.name}`);
      continue;
    }
    console.log(`${apply ? "restore" : "would restore"}: ${p.name}`);
    if (!apply) continue;
    await ServiceProject.updateOne(
      { _id: p._id, status: "ON_HOLD" },
      {
        $set: { status: "NOT_STARTED" },
        $push: { history: { fromStatus: "ON_HOLD", toStatus: "NOT_STARTED", reason: "Back to Not started (owner)", at: now, madeAt: now } },
      }
    );
    await recordServiceAudit("projects.restore_not_started", { projectId: p._id, name: p.name });
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
