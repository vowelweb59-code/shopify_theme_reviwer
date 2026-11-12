/**
 * One-off: re-creates, as bare projects, the 21 projects deleted by remove-non-live-projects.ts on 2026-11-12 (owner asked for it).
 * Only the name, theme, type and a starting status come back; descriptions, members, dates and earlier rounds are gone.
 * Names ending in " Update" come back as Theme Update projects (no status), the rest as Theme Design & Development in Planning.
 *
 *   npx tsx --env-file=.env.production.local scripts/recreate-removed-projects.ts          # dry run
 *   npx tsx --env-file=.env.production.local scripts/recreate-removed-projects.ts --apply  # writes (owner runs it)
 *
 * Idempotent: a project with the same name on the same theme is left alone.
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");

const REMOVED: Record<string, string[]> = {
  Velocity: ["Velocity"],
  Grocery: ["Grocery"],
  Breeze: ["Breeze"],
  Aspire: ["Aspire Wellness", "Aspire Clothing", "Aspire Arts", "Aspire Beauty", "Aspire"],
  Kombat: ["Kombat"],
  Pretty: ["Pretty"],
  Silver: ["Silver Update", "Home Decor"],
  Loyal: ["Loyal Update", "Loyal 1"],
  Apollo: ["Apollo"],
  Auto: ["Auto"],
  Legacy: ["Legacy 1"],
  Krafton: ["Krafton Update", "Krafton project"],
  Aroma: ["Aroma Update", "Aroma project"],
};

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  let created = 0;
  for (const [themeName, names] of Object.entries(REMOVED)) {
    const theme = await Theme.findOne({ name: themeName }).select("_id").lean<{ _id: unknown }>();
    if (!theme) {
      console.log(`${themeName}: theme not found, skipped`);
      continue;
    }
    for (const name of names) {
      if (await Project.exists({ themeId: theme._id, name })) {
        console.log(`${themeName}: "${name}" already exists, skipped`);
        continue;
      }
      const isUpdate = / Update$/.test(name);
      console.log(`${themeName}: ${apply ? "creating" : "would create"} "${name}" (${isUpdate ? "Theme Update" : "Theme Design & Development, Planning"})`);
      if (apply) {
        await Project.create({ themeId: theme._id, name, type: isUpdate ? "theme_update" : "theme_development", status: isUpdate ? null : "planning" });
        created++;
      }
    }
    if (apply) await AdminAudit.create({ action: "projects.recreate_removed", detail: { themeId: String(theme._id), themeName, names } });
  }
  console.log(apply ? `\nCreated ${created} project(s).` : "\nDry run: nothing written. Pass --apply to create.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
