/**
 * Moves theme projects to Under Review / Live from where their theme is seen (owner, 2026-11-14): on either Shopify ops demo store
 * (theme-store-ops-admin, theme-store-ops-breaking) = Under Review; live on the public Shopify Theme Store = Live. Only forward, only
 * Theme Design & Development projects, and never a Rejected, Active, On Hold or Completed one (lib/projects/reviewStatus.ts). It runs by
 * itself after every demo-store check and every Theme Store catalog read; this brings the projects you already have in line, and shows
 * the evidence for each change.
 *
 *   npx tsx --env-file=.env.production.local scripts/sync-review-statuses.ts           # dry run: lists the changes
 *   npx tsx --env-file=.env.production.local scripts/sync-review-statuses.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { syncReviewStatuses } from "../lib/projects/syncReviewStatuses";
import { AdminAudit } from "../models/admin-audit";

const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const changes = await syncReviewStatuses({ dryRun: !apply });
  if (changes.length === 0) console.log("No project needs to move: none is behind where its theme has been seen.");
  for (const c of changes) console.log(`  ${c.name}: ${c.from} -> ${c.to}   (${c.why})`);
  if (apply && changes.length > 0) await AdminAudit.create({ action: "projects.sync_review_statuses", detail: { changes } });
  if (!apply) console.log("\nDry run: nothing written. Pass --apply to do it.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
