/**
 * Sets the early-stage status of Theme / Preset Design & Development projects from who has reported on them (owner, 2026-11-14):
 * only designers reporting = Under Designing, a developer's reports appearing = Under Development. Only projects that are still
 * Planning or Under Designing move, only forward (lib/projects/buildStatus.ts). New reports do this on their own at import; this
 * brings the projects you already have in line.
 *
 *   npx tsx --env-file=.env.production.local scripts/sync-build-statuses.ts           # dry run: lists the changes
 *   npx tsx --env-file=.env.production.local scripts/sync-build-statuses.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { syncBuildStatuses } from "../lib/projects/syncBuildStatuses";
import { AdminAudit } from "../models/admin-audit";

const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const changes = await syncBuildStatuses({ dryRun: !apply });
  if (changes.length === 0) console.log("Every Planning / Under Designing project already matches who has reported on it.");
  for (const c of changes) console.log(`  ${c.name}: ${c.from} -> ${c.to}`);
  if (apply && changes.length > 0) await AdminAudit.create({ action: "projects.sync_build_statuses", detail: { changes } });
  if (!apply) console.log("\nDry run: nothing written. Pass --apply to do it.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
