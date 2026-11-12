/**
 * LIST ONLY. Lists the projects of themes that are not live on the Shopify Theme Store. It no longer deletes anything: the owner
 * decided (2026-11-12) that those projects stay and only the Themes tab hides non-live themes. (An earlier version had --apply,
 * which deleted 21 projects on production; they were re-created bare by recreate-removed-projects.ts.)
 *
 *   npm run themes:remove-non-live-projects     # prints the list, writes nothing
 *
 * "Not live" = no Theme Store listing in the daily catalog read, matched by saved slug, else the slug derived from the name.
 */
import { connectToDatabase } from "../lib/db/connect";
import { syncThemesFromCatalog } from "../lib/themes/syncFromCatalog";
import { Project } from "../models/project";

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`Read-only against ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const sync = await syncThemesFromCatalog({ dryRun: true });
  if (sync.live === 0 && sync.notLive === 0) {
    console.log("The Theme Store catalog is empty (never read), so no theme can be judged. Run the Theme Store refresh first.");
    return;
  }
  console.log(`Catalog sync: ${sync.live} live, ${sync.notLive} not live.\n`);
  console.log(`Not live: ${sync.notLiveThemes.map((t) => t.name).join(", ") || "none"}\n`);

  let projectCount = 0;
  for (const theme of sync.notLiveThemes) {
    const projects = await Project.find({ themeId: theme._id }).select("name").lean<{ name: string }[]>();
    if (projects.length === 0) continue;
    console.log(`${theme.name}: ${projects.length} project(s): ${projects.map((p) => p.name).join("; ")}`);
    projectCount += projects.length;
  }
  console.log(`\n${projectCount} project(s) on ${sync.notLive} not-live theme(s). Nothing is deleted or written.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
