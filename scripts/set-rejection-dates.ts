/**
 * Sets "Rejected on" for three rejected projects whose exact day is not known (owner, 2026-11-13: "keep the 15th of the month as the
 * rejected day"): Grocery rejected in July, Legacy 1 in September, Breeze in October (2026). Only a project that is Rejected and has no
 * rejection date yet changes; a date already entered is never overwritten. The change is recorded in admin_audit_log.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-rejection-dates.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-rejection-dates.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";

const apply = process.argv.includes("--apply");
const DATES: { name: RegExp; label: string; day: string }[] = [
  { name: /^grocery$/i, label: "Grocery", day: "2026-07-15" },
  { name: /^legacy\s*1$/i, label: "Legacy 1", day: "2026-09-15" },
  { name: /^breeze$/i, label: "Breeze", day: "2026-10-15" },
];

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const projects = await Project.find({ type: { $in: ["theme_development", null] }, status: "rejected" }).select("name rejectedOn").lean<{ _id: unknown; name: string; rejectedOn?: Date | null }[]>();
  for (const d of DATES) {
    const matches = projects.filter((p) => d.name.test(p.name.trim()));
    if (matches.length === 0) console.log(`${d.label}: no Rejected project found.`);
    for (const p of matches) {
      if (p.rejectedOn) {
        console.log(`${d.label}: already has ${new Date(p.rejectedOn).toISOString().slice(0, 10)}, left alone.`);
        continue;
      }
      console.log(`${d.label}: ${apply ? "setting" : "would set"} Rejected on ${d.day}.`);
      if (apply) {
        await Project.updateOne({ _id: p._id }, { $set: { rejectedOn: new Date(`${d.day}T00:00:00.000Z`) } });
        await AdminAudit.create({ action: "projects.set_rejection_date", detail: { project: p.name, projectId: String(p._id), rejectedOn: d.day } });
      }
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
