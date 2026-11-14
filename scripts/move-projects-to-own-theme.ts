/**
 * Moves projects that hang on the wrong theme row onto the theme row of their own name (owner, 2026-11-14: the Theme Design &
 * Development projects "Dynamic" and "Flaunt" sat on the Adorn row, while the Dynamic and Flaunt rows had none). Only the project's
 * `themeId` changes; its days, members, rounds and hours entries stay. A project is moved only when a theme row of exactly its name
 * exists, it sits on a different row, and that row has no Theme Design & Development project of its own yet.
 *
 *   npx tsx --env-file=.env.production.local scripts/move-projects-to-own-theme.ts           # dry run
 *   npx tsx --env-file=.env.production.local scripts/move-projects-to-own-theme.ts --apply   # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");
const NAMES = ["Dynamic", "Flaunt"];

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  const themes = await Theme.find().select("name").lean<{ _id: unknown; name: string }[]>();
  const nameOf = new Map(themes.map((t) => [String(t._id), t.name]));
  const moved: Record<string, unknown>[] = [];

  for (const name of NAMES) {
    const target = themes.filter((t) => t.name.trim().toLowerCase() === name.toLowerCase());
    if (target.length !== 1) {
      console.log(`${name}: ${target.length} theme rows of that name — skipped`);
      continue;
    }
    const projects = await Project.find({ name: new RegExp(`^${name}$`, "i"), type: { $in: ["theme_development", null] } }).select("name themeId").lean<{ _id: unknown; name: string; themeId: unknown }[]>();
    for (const p of projects) {
      if (String(p.themeId) === String(target[0]._id)) {
        console.log(`${name}: already on its own theme row`);
        continue;
      }
      const own = await Project.countDocuments({ themeId: target[0]._id, type: { $in: ["theme_development", null] } });
      if (own > 0) {
        console.log(`${name}: its own row already has ${own} Theme Design & Development project(s) — skipped`);
        continue;
      }
      console.log(`${name}: "${p.name}" moves from the "${nameOf.get(String(p.themeId))}" row to the "${target[0].name}" row`);
      moved.push({ project: p.name, projectId: String(p._id), fromThemeId: String(p.themeId), toThemeId: String(target[0]._id) });
      if (apply) await Project.updateOne({ _id: p._id, themeId: p.themeId }, { $set: { themeId: target[0]._id } });
    }
  }
  if (apply && moved.length > 0) await AdminAudit.create({ action: "projects.move_to_own_theme", detail: { moved } });
  console.log(`\n${moved.length} project(s) ${apply ? "moved" : "would move"}.${apply ? "" : " Dry run: nothing written. Pass --apply to do it."}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
