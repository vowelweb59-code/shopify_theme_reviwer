/**
 * Moves the "Home Decor" and "Pretty" projects from Under Development to Under Designing (owner, 2026-11-13: both are still being
 * designed). Only a Theme Design & Development project that is currently Under Development changes; the old status is saved in
 * admin_audit_log (projects.set_status).
 *
 *   npx tsx --env-file=.env.production.local scripts/set-designing-projects.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-designing-projects.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";

const apply = process.argv.includes("--apply");
const NAMES = [/^home d[eé]cor$/i, /^pretty$/i];

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const projects = await Project.find({ type: { $in: ["theme_development", null] }, status: "under_development" }).select("name status").lean<{ _id: unknown; name: string }[]>();
  const matches = projects.filter((p) => NAMES.some((re) => re.test(p.name.trim())));
  if (matches.length === 0) console.log("No Under Development project named Home Decor or Pretty was found.");
  for (const p of matches) {
    console.log(`"${p.name}": ${apply ? "setting" : "would set"} Under Designing (was Under Development).`);
    if (apply) {
      await Project.updateOne({ _id: p._id }, { $set: { status: "under_designing" } });
      await AdminAudit.create({ action: "projects.set_status", detail: { project: p.name, projectId: String(p._id), was: "under_development", now: "under_designing" } });
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
