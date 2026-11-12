/**
 * Adds a theme's main project: a Theme Design & Development project named after the theme (like "Soft" and "Gravity").
 *
 *   npx tsx --env-file=.env.production.local scripts/add-project.ts Rare                                   # dry run
 *   npx tsx --env-file=.env.production.local scripts/add-project.ts Rare --apply                           # writes (owner runs it)
 *   npx tsx --env-file=.env.production.local scripts/add-project.ts Rare --portal Themeshopy --status live --apply
 *
 * Defaults: portal Themeshopy, status live. Members, design/development days and deadline are left empty (set them on the project).
 * The theme must exist (npm run theme:add adds one); a project with the same name on the same theme is left alone.
 */
import { connectToDatabase } from "../lib/db/connect";
import { PORTALS, PROJECT_STATUSES } from "../lib/projects/constants";
import { AdminAudit } from "../models/admin-audit";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

function option(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const themeName = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  const portal = option("portal") ?? "Themeshopy";
  const status = option("status") ?? "live";
  if (!themeName) throw new Error('Usage: add-project.ts "<Theme name>" [--portal Themeshopy] [--status live] [--apply]');
  if (!(PORTALS as readonly string[]).includes(portal)) throw new Error(`--portal must be one of: ${PORTALS.join(", ")}`);
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) throw new Error(`--status must be one of: ${PROJECT_STATUSES.join(", ")}`);

  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const theme = await Theme.findOne({ name: themeName }).select("_id name").lean<{ _id: unknown; name: string }>();
  if (!theme) throw new Error(`Theme "${themeName}" not found. Add it first with: npm run theme:add -- "${themeName}" --apply`);
  if (await Project.exists({ themeId: theme._id, name: theme.name })) {
    console.log(`A project named "${theme.name}" already exists on this theme. Nothing to do.`);
    return;
  }
  console.log(`${apply ? "Creating" : "Would create"} project "${theme.name}": Theme Design & Development, portal ${portal}, status ${status}.`);
  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to create.");
    return;
  }
  await Project.create({ themeId: theme._id, name: theme.name, type: "theme_development", status, portal });
  await AdminAudit.create({ action: "projects.add", detail: { themeId: String(theme._id), themeName: theme.name, portal, status } });
  console.log("\nCreated.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
