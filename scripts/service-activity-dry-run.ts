import { connectToDatabase } from "@/lib/db/connect";
import { applyActivityRules } from "@/lib/service/projects/activity-rules";

// Read-only: lists what the automatic status rules would change now (nothing is written).
//   npx tsx --env-file=.env.production.local scripts/service-activity-dry-run.ts
async function main() {
  await connectToDatabase();
  const r = await applyActivityRules(new Date(), { dryRun: true });
  console.log(JSON.stringify({ held: r.held, resumed: r.resumed, reopened: r.reopened, reasons: r.reasons }, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
