/**
 * Removes the projects of themes that are not live on the Shopify Theme Store (the Themes tab keeps live themes only),
 * together with the time entries logged against those projects.
 *
 *   npm run themes:remove-non-live-projects                  # dry run: lists what would go, changes nothing
 *   npm run themes:remove-non-live-projects -- --apply       # deletes
 *   npx tsx --env-file=.env.production.local scripts/remove-non-live-projects.ts --apply   # the live database (owner runs it)
 *
 * "Not live" = Theme.themeStoreLive === false, decided from the daily Theme Store read (this script re-runs that sync first,
 * so the Theme Store catalog must have been read at least once). Themes whose status is not decided are never touched. The
 * themes themselves are kept (only hidden); Sales, Analytics and Chat time reports still match on them. Each deletion is
 * written to admin_audit_log. Deleted hours cannot be restored: take a backup before --apply.
 */
import { connectToDatabase } from "../lib/db/connect";
import { syncThemesFromCatalog } from "../lib/themes/syncFromCatalog";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";
import { TimeEntry } from "../models/time-entry";

const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  // A dry run decides from the catalog without writing the live/not-live flags.
  const sync = await syncThemesFromCatalog({ dryRun: !apply });
  if (sync.live === 0 && sync.notLive === 0) {
    console.log("The Theme Store catalog is empty (never read), so no theme can be judged. Run the Theme Store refresh first.");
    return;
  }
  console.log(`Catalog sync: ${sync.live} live, ${sync.notLive} not live.\n`);

  const notLive = sync.notLiveThemes;
  console.log(`Not live: ${notLive.map((t) => t.name).join(", ") || "none"}\n`);
  let projectCount = 0;
  let entryCount = 0;
  for (const theme of notLive) {
    const projects = await Project.find({ themeId: theme._id }).select("name").lean<{ _id: unknown; name: string }[]>();
    if (projects.length === 0) continue;
    const ids = projects.map((p) => p._id);
    const entries = await TimeEntry.countDocuments({ projectId: { $in: ids } });
    console.log(`${theme.name}: ${projects.length} project(s), ${entries} time entr${entries === 1 ? "y" : "ies"}: ${projects.map((p) => p.name).join("; ")}`);
    projectCount += projects.length;
    entryCount += entries;
    if (apply) {
      await TimeEntry.deleteMany({ projectId: { $in: ids } });
      await Project.deleteMany({ _id: { $in: ids } });
      await AdminAudit.create({ action: "projects.remove_not_live_theme", detail: { themeId: String(theme._id), themeName: theme.name, projects: projects.length, timeEntries: entries } });
    }
  }
  console.log(`\n${apply ? "Deleted" : "Would delete"} ${projectCount} project(s) and ${entryCount} time entries across ${notLive.length} not-live theme(s).`);
  if (!apply) console.log("Dry run: nothing written. Pass --apply to delete.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
