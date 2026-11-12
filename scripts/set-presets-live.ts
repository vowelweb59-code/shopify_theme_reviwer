/**
 * Marks the preset projects of the live themes as Live (owner, 2026-11-12: all presets of Adorn, Flaunt, Dynamic, Renovate,
 * Voltix, Gravity, Rare, Soft, Nexus, Noble and Zeal are already live). Only Preset Development projects whose status is not
 * already Live change; nothing else is touched.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-presets-live.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-presets-live.ts --apply   # writes (owner runs it)
 *
 * Effect on Chat reports: a theme with a preset project that is not Live counts new preset reports as development hours;
 * once all its presets are Live they are logged as hours on its Theme Update project (lib/chat/importReports.ts).
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");
const THEMES = ["Adorn", "Flaunt", "Dynamic", "Renovate", "Voltix", "Gravity", "Rare", "Soft", "Nexus", "Noble", "Zeal"];

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  let changed = 0;
  for (const name of THEMES) {
    const theme = await Theme.findOne({ name }).select("_id").lean<{ _id: unknown }>();
    if (!theme) {
      console.log(`${name}: theme not found, skipped`);
      continue;
    }
    const projects = await Project.find({ themeId: theme._id, type: "preset_development", status: { $ne: "live" } }).select("name status").lean<{ _id: unknown; name: string; status: string | null }[]>();
    for (const p of projects) {
      console.log(`${name}: ${apply ? "setting" : "would set"} "${p.name}" ${p.status ?? "no status"} -> live`);
      if (apply) {
        await Project.updateOne({ _id: p._id }, { $set: { status: "live" } });
        await AdminAudit.create({ action: "projects.set_live", detail: { themeName: name, projectId: String(p._id), project: p.name, was: p.status } });
      }
      changed++;
    }
  }
  console.log(`\n${changed} preset project(s) ${apply ? "set to live" : "would change"}.`);
  if (!apply) console.log("Dry run: nothing written. Pass --apply to change them.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
