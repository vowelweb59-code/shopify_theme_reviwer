/**
 * Marks the "Loyal 1" project Rejected (owner, 2026-11-13: the theme was rejected; the project was left on Planning by the
 * 2026-11-12 recreation). Only a Theme Design & Development project named "Loyal 1" that is still Planning changes; the old status is
 * saved in admin_audit_log (projects.set_status). Its portal (SAMS) is untouched.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-loyal-rejected.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-loyal-rejected.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";

const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const projects = await Project.find({ type: { $in: ["theme_development", null] }, name: /^loyal\s*1$/i }).select("name status portal").lean<{ _id: unknown; name: string; status: string | null; portal: string | null }[]>();
  if (projects.length === 0) console.log('No project named "Loyal 1" was found.');
  for (const p of projects) {
    if (p.status !== "planning") {
      console.log(`"${p.name}": status is ${p.status}, left alone.`);
      continue;
    }
    console.log(`"${p.name}": ${apply ? "setting" : "would set"} Rejected (was Planning, portal ${p.portal ?? "none"}).`);
    if (apply) {
      await Project.updateOne({ _id: p._id }, { $set: { status: "rejected" } });
      await AdminAudit.create({ action: "projects.set_status", detail: { project: p.name, projectId: String(p._id), was: "planning", now: "rejected" } });
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
