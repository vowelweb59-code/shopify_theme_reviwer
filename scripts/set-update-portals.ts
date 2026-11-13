/**
 * Puts the Theme Update projects of themes whose portal is known into that portal (owner, 2026-11-12): Loyal Update and Krafton Update
 * to SAMS, Aroma Update to Fresco Solutions. Only a project whose portal is not set yet changes.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-update-portals.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-update-portals.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";

const apply = process.argv.includes("--apply");
const PORTALS: Record<string, string> = { "Loyal Update": "SAMS", "Krafton Update": "SAMS", "Aroma Update": "Fresco Solutions" };

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  for (const [name, portal] of Object.entries(PORTALS)) {
    const p = await Project.findOne({ name, type: "theme_update", portal: null }).select("_id").lean<{ _id: unknown }>();
    if (!p) {
      console.log(`"${name}": not found without a portal, skipped.`);
      continue;
    }
    console.log(`"${name}": ${apply ? "setting" : "would set"} ${portal}.`);
    if (apply) {
      await Project.updateOne({ _id: p._id }, { $set: { portal } });
      await AdminAudit.create({ action: "projects.set_status", detail: { project: name, projectId: String(p._id), portal } });
    }
  }
  if (!apply) console.log("\nDry run: nothing written. Pass --apply to do it.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
