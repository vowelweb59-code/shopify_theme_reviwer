/**
 * Shares the fixed (hand-entered) design / development days of older themes between the people who worked them (owner, 2026-11-14),
 * so each person's share is priced in the cost (lib/projects/fixedDayInputs.ts). Sets `designDaysSplit` / `developmentDaysSplit` on
 * the project; a project with a split no longer uses the single `...DaysBy` person for that role. Old values go to admin_audit_log
 * (`projects.set_day_splits`). Days that are blank on the project price nothing yet (Noble and Grocery design have none).
 *
 *   npx tsx --env-file=.env.production.local scripts/set-day-splits.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-day-splits.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";
import { TeamMember } from "../models/team-member";

const apply = process.argv.includes("--apply");

// project name, which days, shares by sheet first name (add up to 1)
const SPLITS: { project: string; days: "design" | "development"; shares: Record<string, number> }[] = [
  { project: "Gravity", days: "design", shares: { Pranay: 1 } }, // all Pranay (no day reports for Noman)
  { project: "Noble", days: "design", shares: { Pranay: 0.7, Mussadique: 0.3 } },
  { project: "Grocery", days: "design", shares: { Pranay: 0.1, Junaid: 0.25, Mussadique: 0.65 } },
  { project: "Grocery", days: "development", shares: { Aarti: 0.6, Shailesh: 0.4 } },
  { project: "Rare", days: "development", shares: { Ehtesham: 0.7, Shailesh: 0.3 } },
  { project: "Breeze", days: "design", shares: { Noman: 0.6, Mussadique: 0.4 } },
];
const PERSON: Record<string, string> = {
  noman: "noaman ather",
  mussadique: "musaddique afsar",
  aarti: "arti mishra",
  pranay: "pranay nimje",
  ehtesham: "ehtesham deshmukh",
  shailesh: "shailesh parshionikar",
  junaid: "junaid ahmad",
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const members = await TeamMember.find().select("name").lean<{ _id: unknown; name: string }[]>();
  const byName = new Map(members.map((m) => [norm(m.name), m]));
  const changes: Record<string, unknown>[] = [];

  for (const s of SPLITS) {
    const total = Object.values(s.shares).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 1e-9) throw new Error(`${s.project} ${s.days}: shares add up to ${total}, not 1`);
    const project = await Project.findOne({ name: new RegExp(`^${s.project}$`, "i"), type: { $in: ["theme_development", null] } }).select("name designDays developmentDays designDaysSplit developmentDaysSplit").lean<{ _id: unknown; name: string; designDays: number | null; developmentDays: number | null; designDaysSplit?: unknown[]; developmentDaysSplit?: unknown[] } | null>();
    if (!project) {
      console.log(`${s.project}: no such project — skipped`);
      continue;
    }
    const split = Object.entries(s.shares).map(([first, share]) => {
      const m = byName.get(PERSON[norm(first)] ?? "");
      if (!m) throw new Error(`No team member for "${first}"`);
      return { memberId: m._id, share, name: m.name };
    });
    const days = s.days === "design" ? project.designDays : project.developmentDays;
    console.log(`${project.name} ${s.days} days (${days ?? "none entered"}): ${split.map((p) => `${p.name} ${Math.round(p.share * 100)}%${days ? ` = ${Math.round(days * p.share * 10) / 10} d` : ""}`).join(", ")}${days ? "" : "   (no days yet: nothing priced until they are entered)"}`);
    const field = s.days === "design" ? "designDaysSplit" : "developmentDaysSplit";
    changes.push({ project: project.name, field, before: (s.days === "design" ? project.designDaysSplit : project.developmentDaysSplit) ?? [], after: split.map((p) => ({ name: p.name, share: p.share })) });
    if (apply) await Project.updateOne({ _id: project._id }, { $set: { [field]: split.map((p) => ({ memberId: p.memberId, share: p.share })) } });
  }
  if (apply && changes.length > 0) await AdminAudit.create({ action: "projects.set_day_splits", detail: { changes } });
  console.log(`\n${changes.length} split(s) ${apply ? "set" : "would be set"}.${apply ? "" : " Dry run: nothing written. Pass --apply to do it."}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
