/**
 * Removes the five empty Aspire projects left over from the 2026-11-12 recreation, and "Silver Update" (Silver was never started, so it has
 * no updates; owner, same day). Aspire's reports became Rare's, and Rare already has
 * the matching projects (Rare, Rare Touch, Rare Presence, Rare Charisma, Rare Synergy). A project is removed only if it is empty:
 * no reports linked, no hours logged, no members, no earlier rounds, no days, no deadline and no description, and its Rare equivalent
 * exists (Silver Update needs none). The full record of each removed project is saved in admin_audit_log (action projects.remove_empty_duplicate) so it can be recreated.
 *
 *   npx tsx --env-file=.env.production.local scripts/remove-empty-aspire-projects.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/remove-empty-aspire-projects.ts --apply   # deletes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { Theme } from "../models/theme";
import { TimeEntry } from "../models/time-entry";

const apply = process.argv.includes("--apply");
const EQUIVALENT: Record<string, string> = { Aspire: "Rare", "Aspire Beauty": "Rare Touch", "Aspire Arts": "Rare Presence", "Aspire Clothing": "Rare Charisma", "Aspire Wellness": "Rare Synergy" };

type Doc = { _id: unknown; name: string; members: unknown[]; rounds: unknown[]; designDays: number | null; developmentDays: number | null; deadline: Date | null; description: string };

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const aspire = await Theme.findOne({ name: "Aspire" }).select("_id").lean<{ _id: unknown }>();
  const rare = await Theme.findOne({ name: "Rare" }).select("_id").lean<{ _id: unknown }>();
  if (!aspire || !rare) throw new Error("Theme Aspire or Rare not found.");

  const silver = await Theme.findOne({ name: "Silver" }).select("_id").lean<{ _id: unknown }>();
  const projects = [
    ...(await Project.find({ themeId: aspire._id }).lean<Doc[]>()),
    ...(silver ? await Project.find({ themeId: silver._id, name: "Silver Update", type: "theme_update" }).lean<Doc[]>() : []),
  ];
  for (const p of projects) {
    const neverStarted = p.name === "Silver Update";
    const target = EQUIVALENT[p.name];
    const equivalent = neverStarted ? true : target ? await Project.exists({ themeId: rare._id, name: target }) : null;
    const reports = await ChatReport.countDocuments({ projectId: p._id });
    const entries = await TimeEntry.countDocuments({ projectId: p._id });
    const empty = reports === 0 && entries === 0 && p.members.length === 0 && p.rounds.length === 0 && p.designDays === null && p.developmentDays === null && p.deadline === null && !p.description;
    if (!equivalent || !empty) {
      console.log(`"${p.name}": kept (${!equivalent ? `no Rare equivalent "${target ?? "?"}"` : "it holds data"}).`);
      continue;
    }
    console.log(`"${p.name}": ${apply ? "removing" : "would remove"} (${neverStarted ? "empty; Silver was never started" : `empty; its Rare equivalent is "${target}"`}).`);
    if (apply) {
      await AdminAudit.create({ action: "projects.remove_empty_duplicate", detail: { project: p.name, equivalent: target ?? null, record: JSON.parse(JSON.stringify(p)) } });
      await Project.deleteOne({ _id: p._id });
    }
  }
  if (!apply) console.log("\nDry run: nothing written. Pass --apply to remove them.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
