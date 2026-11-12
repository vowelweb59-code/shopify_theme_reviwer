/**
 * Corrects two things from the 2026-11-12 report clean-up (owner, same day):
 *
 *  1. "Automobile" is its own new theme in SAMS (the reports say "Automobile | New Theme" and "Theme Development"), not a Noble preset.
 *     The 11 reports linked to "Noble Automobile" move to the theme row "Auto" as new-theme work, unlinked from the preset project;
 *     the "Auto" project is renamed "Automobile", put in SAMS and set Under development. Noble's own Automobile preset is live:
 *     "Noble Automobile" stays, as Live.
 *  2. Legacy is a rejected theme in Flex: its project goes to the Flex portal (status Rejected).
 *  3. "Loyal 1" goes to the SAMS portal (its status is left as it is).
 *  4. Breeze and Grocery (rejected) go to the Fresco Solutions portal.
 *
 *   npx tsx --env-file=.env.production.local scripts/fix-automobile-legacy.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/fix-automobile-legacy.ts --apply   # writes (owner runs it)
 *
 * Old values of the moved reports are saved in admin_audit_log (reports.link_preset, detail.before).
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const noble = await Theme.findOne({ name: "Noble" }).select("_id").lean<{ _id: unknown }>();
  const auto = await Theme.findOne({ name: "Auto" }).select("_id").lean<{ _id: unknown }>();
  const legacy = await Theme.findOne({ name: "Legacy" }).select("_id").lean<{ _id: unknown }>();
  if (!noble || !auto || !legacy) throw new Error("Theme Noble, Auto or Legacy not found.");

  // 1. Automobile
  const presetProject = await Project.findOne({ themeId: noble._id, name: "Noble Automobile" }).select("_id status").lean<{ _id: unknown; status: string }>();
  const reports = await ChatReport.find({ themeId: noble._id, kind: "preset", preset: "Automobile", projectId: presetProject?._id ?? null })
    .select("key date sender minutes themeName kind preset projectId")
    .lean<{ _id: unknown; key: string; minutes: number; themeName: string; kind: string | null; preset: string | null; projectId: unknown }[]>();
  console.log(`${reports.length} Automobile report(s), ${(reports.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)} h -> theme "Auto" (Automobile), new-theme work, unlinked from the Noble preset.`);
  const autoProject = await Project.findOne({ themeId: auto._id, type: "theme_development" }).select("_id name status portal").lean<{ _id: unknown; name: string; status: string; portal: string | null }>();
  console.log(`Project "${autoProject?.name}": ${apply ? "setting" : "would set"} name Automobile, SAMS, under development.`);
  if (presetProject && presetProject.status !== "live") console.log('Project "Noble Automobile": ' + (apply ? "setting" : "would set") + " live.");

  // 2. Legacy
  const legacyProject = await Project.findOne({ themeId: legacy._id, type: "theme_development" }).select("_id name status portal").lean<{ _id: unknown; name: string; status: string; portal: string | null }>();
  console.log(`Project "${legacyProject?.name}": ${apply ? "setting" : "would set"} Flex, rejected.`);

  // 3. Loyal
  const loyalProject = await Project.findOne({ name: "Loyal 1" }).select("_id portal").lean<{ _id: unknown; portal: string | null }>();
  console.log(`Project "Loyal 1": ${loyalProject ? (apply ? "setting" : "would set") + " SAMS" : "not found, skipped"}.`);

  // 4. Breeze and Grocery (rejected) are Fresco Solutions themes
  const frescoProjects: { _id: unknown; name: string }[] = [];
  for (const themeName of ["Breeze", "Grocery"]) {
    const t = await Theme.findOne({ name: themeName }).select("_id").lean<{ _id: unknown }>();
    const pr = t ? await Project.findOne({ themeId: t._id, type: "theme_development" }).select("_id name").lean<{ _id: unknown; name: string }>() : null;
    if (pr) frescoProjects.push(pr);
    console.log(`Project "${pr?.name ?? themeName}": ${pr ? (apply ? "setting" : "would set") + " Fresco Solutions" : "not found, skipped"}.`);
  }

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to do it.");
    return;
  }
  if (reports.length > 0) {
    await ChatReport.bulkWrite(reports.map((r) => ({ updateOne: { filter: { _id: r._id as never }, update: { $set: { themeId: auto._id, themeName: "Automobile", kind: "theme", preset: null, projectId: null } } } })));
    await AdminAudit.create({
      action: "reports.link_preset",
      detail: { theme: "Auto", moved: reports.length, before: reports.map((r) => ({ key: r.key, themeId: String(noble._id), themeName: r.themeName, kind: r.kind, preset: r.preset, projectId: r.projectId ? String(r.projectId) : null })) },
    });
  }
  if (autoProject) await Project.updateOne({ _id: autoProject._id }, { $set: { name: "Automobile", portal: "SAMS", status: "under_development" } });
  if (presetProject && presetProject.status !== "live") await Project.updateOne({ _id: presetProject._id }, { $set: { status: "live" } });
  if (legacyProject) await Project.updateOne({ _id: legacyProject._id }, { $set: { portal: "Flex", status: "rejected" } });
  if (loyalProject) await Project.updateOne({ _id: loyalProject._id }, { $set: { portal: "SAMS" } });
  for (const pr of frescoProjects) await Project.updateOne({ _id: pr._id }, { $set: { portal: "Fresco Solutions" } });
  await AdminAudit.create({ action: "projects.set_status", detail: { note: "Automobile to SAMS, Noble Automobile live, Legacy to Flex, Loyal 1 to SAMS, Breeze and Grocery to Fresco Solutions", auto: autoProject ? String(autoProject._id) : null, legacy: legacyProject ? String(legacyProject._id) : null } });
  console.log("\nDone.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
