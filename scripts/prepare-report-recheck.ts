/**
 * Sets things up before the flagged Chat reports are re-checked (owner decisions, 2026-11-12). Three steps, each skipped when done:
 *
 *  1. "Noble Automobile" (Preset Development, Under development, Noble's portal; Automobile is not live yet): the 11 reports whose theme line is "Automobile" / "Automobile Theme"
 *     are Noble preset reports, so they are linked to it (kind preset, preset Automobile) instead of becoming Noble Update hours.
 *  2. Home Décor: "Space" is its working name. Its project "Home Decor", which sits on Silver, moves to the Home Décor theme (portal
 *     Themeshopy) so its reports have a project to count on.
 *  3. "Voltix Update" (Theme Update): Voltix had no Update project to log its update hours on.
 *  4. Themes being built but not live get their project in the right portal tab, Under development (not "No portal" / Planning):
 *     Velocity -> Vowel Web; Kombat, Pretty, Home Décor -> Themeshopy; Apollo -> SAMS.
 *  5. Rejected themes keep a project with status Rejected: Breeze, Legacy, Grocery (its reports say "Organic theme"), Aroma (Fresco
 *     Solutions) and Krafton (SAMS). The portal of the first three was lost when their projects were deleted on 2026-11-12; set it on the project page.
 *
 *   npx tsx --env-file=.env.production.local scripts/prepare-report-recheck.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/prepare-report-recheck.ts --apply   # writes (owner runs it)
 *
 * Run it BEFORE pressing Re-check on the Chat page. Old report values are saved in admin_audit_log (reports.link_preset, detail.before).
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");
const PORTAL = "Themeshopy";

async function themeId(name: string): Promise<unknown> {
  const t = await Theme.findOne({ name }).select("_id").lean<{ _id: unknown }>();
  if (!t) throw new Error(`Theme "${name}" not found.`);
  return t._id;
}

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  // 1. Noble Automobile
  const noble = await themeId("Noble");
  const noblePortal = (await Project.findOne({ themeId: noble, type: "theme_development" }).select("portal").lean<{ portal?: string | null }>())?.portal ?? null;
  let automobile = await Project.findOne({ themeId: noble, name: "Noble Automobile" }).select("_id").lean<{ _id: unknown }>();
  if (!automobile) {
    console.log(`Project "Noble Automobile": ${apply ? "creating" : "would create"} (preset_development, under_development, ${noblePortal ?? "no portal"}).`);
    if (apply) automobile = (await Project.create({ themeId: noble, name: "Noble Automobile", type: "preset_development", status: "under_development", portal: noblePortal })) as unknown as { _id: unknown };
  } else console.log('Project "Noble Automobile": exists.');
  const reports = await ChatReport.find({ status: "needs_review", themeName: /^automobile(\s+theme)?$/i })
    .select("key date sender minutes themeName kind preset projectId")
    .lean<{ _id: unknown; key: string; date: Date; sender: string; minutes: number; themeName: string; kind: string | null; preset: string | null; projectId: unknown }[]>();
  console.log(`  ${reports.length} Automobile report(s), ${(reports.reduce((s, r) => s + r.minutes, 0) / 60).toFixed(1)} h -> Noble, preset Automobile, linked to "Noble Automobile".`);
  if (apply && automobile && reports.length > 0) {
    await ChatReport.bulkWrite(
      reports.map((r) => ({
        updateOne: {
          filter: { _id: r._id as never },
          update: { $set: { themeId: noble, themeName: "Noble", kind: "preset", preset: "Automobile", projectId: automobile!._id, status: "ok", reason: null } },
        },
      }))
    );
    await AdminAudit.create({
      action: "reports.link_preset",
      detail: { theme: "Noble", preset: "Automobile", linked: reports.length, before: reports.map((r) => ({ key: r.key, themeName: r.themeName, kind: r.kind, preset: r.preset, projectId: r.projectId ? String(r.projectId) : null, status: "needs_review" })) },
    });
  }

  // 2. Home Décor's project
  const homeDecor = await themeId("Home Décor");
  const already = await Project.findOne({ themeId: homeDecor, type: "theme_development" }).select("name").lean<{ name: string }>();
  if (already) console.log(`\nHome Décor already has the project "${already.name}".`);
  else {
    const stray = await Project.findOne({ name: /^home d[eé]cor$/i, themeId: { $ne: homeDecor } }).select("_id name themeId").lean<{ _id: unknown; name: string; themeId: unknown }>();
    if (stray) {
      console.log(`\nProject "${stray.name}" (on another theme): ${apply ? "moving" : "would move"} to Home Décor, portal ${PORTAL}.`);
      if (apply) {
        await Project.updateOne({ _id: stray._id }, { $set: { themeId: homeDecor, portal: PORTAL } });
        await AdminAudit.create({ action: "projects.move", detail: { project: stray.name, projectId: String(stray._id), from: String(stray.themeId), to: "Home Décor" } });
      }
    } else {
      console.log(`\nProject "Home Décor": ${apply ? "creating" : "would create"} (theme_development, planning, ${PORTAL}).`);
      if (apply) await Project.create({ themeId: homeDecor, name: "Home Décor", type: "theme_development", status: "planning", portal: PORTAL });
    }
  }

  // 3. Voltix Update
  const voltix = await themeId("Voltix");
  if (await Project.exists({ themeId: voltix, type: "theme_update" })) console.log("\nVoltix already has a Theme Update project.");
  else {
    console.log(`\nProject "Voltix Update": ${apply ? "creating" : "would create"} (theme_update, ${PORTAL}).`);
    if (apply) {
      await Project.create({ themeId: voltix, name: "Voltix Update", type: "theme_update", status: null, portal: PORTAL });
      await AdminAudit.create({ action: "projects.add", detail: { themeName: "Voltix", project: "Voltix Update", type: "theme_update", portal: PORTAL } });
    }
  }

  // 4 and 5: bare projects (status Planning, from the 2026-11-12 recreation) of themes that are being built or were rejected.
  const asProject = async (themeName: string, change: { portal?: string; status: string }, label: string) => {
    const id = await Theme.findOne({ name: themeName }).select("_id").lean<{ _id: unknown }>();
    if (!id) return console.log(`\n${themeName}: theme not found, skipped.`);
    const projects = await Project.find({ themeId: id._id, type: "theme_development", status: "planning" }).select("name").lean<{ _id: unknown; name: string }[]>();
    for (const pr of projects) {
      console.log(`\nProject "${pr.name}": ${apply ? "setting" : "would set"} ${label}.`);
      if (apply) {
        await Project.updateOne({ _id: pr._id }, { $set: { status: change.status, ...(change.portal ? { portal: change.portal } : {}) } });
        await AdminAudit.create({ action: "projects.set_status", detail: { themeName, project: pr.name, projectId: String(pr._id), was: "planning", now: change.status, portal: change.portal ?? null } });
      }
    }
  };
  await asProject("Velocity", { portal: "Vowel Web", status: "under_development" }, "Vowel Web, under development");
  for (const t of ["Kombat", "Pretty", "Home Décor"]) await asProject(t, { portal: PORTAL, status: "under_development" }, "Themeshopy, under development");
  await asProject("Apollo", { portal: "SAMS", status: "under_development" }, "SAMS, under development");
  for (const t of ["Breeze", "Legacy", "Grocery"]) await asProject(t, { status: "rejected" }, "status rejected");
  await asProject("Aroma", { portal: "Fresco Solutions", status: "rejected" }, "Fresco Solutions, status rejected");
  await asProject("Krafton", { portal: "SAMS", status: "rejected" }, "SAMS, status rejected");

  console.log(apply ? "\nDone. Now press Re-check on the Chat page." : "\nDry run: nothing written. Pass --apply to do it.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
