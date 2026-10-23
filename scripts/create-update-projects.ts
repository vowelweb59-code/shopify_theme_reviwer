import { connectToDatabase } from "@/lib/db/connect";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";

// Creates one Theme Update project per theme, named "<Theme> Update" (e.g. "Adorn Update"). That
// project collects the hours from the theme's update reports and its preset updates
// (lib/chat/importReports.ts). A dry run by default; pass --apply to write. Safe to re-run: a theme
// that already has a Theme Update project is skipped. The portal is copied from the theme's own project.
//   npx tsx --env-file=.env.production.local scripts/create-update-projects.ts          (dry run, live)
//   npx tsx --env-file=.env.production.local scripts/create-update-projects.ts --apply  (writes to live)
const apply = process.argv.includes("--apply");

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const [themes, projects] = await Promise.all([Theme.find().select("name").sort({ name: 1 }).lean(), Project.find().select("themeId type portal").lean()]);
  const hasUpdate = new Set(projects.filter((p) => p.type === "theme_update").map((p) => String(p.themeId)));
  const portalOf = new Map<string, string | null>();
  for (const p of projects) if (p.type !== "theme_update" && p.portal && !portalOf.has(String(p.themeId))) portalOf.set(String(p.themeId), p.portal);

  const todo = themes.filter((t) => !hasUpdate.has(String(t._id)));
  for (const t of todo) console.log(`  + ${t.name} Update  [${portalOf.get(String(t._id)) ?? "no portal"}]`);
  console.log(`\n${todo.length} to create, ${themes.length - todo.length} themes already have one.`);

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to write.");
    return;
  }
  for (const t of todo) {
    await Project.create({ themeId: t._id, name: `${t.name} Update`, type: "theme_update", portal: portalOf.get(String(t._id)) ?? null, members: [] });
  }
  console.log(`\nDone: created ${todo.length} projects.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
