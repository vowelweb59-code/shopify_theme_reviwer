/**
 * Adds a theme that is still being built, with its project, and attaches the reports already posted for it (owner, 2026-11-14:
 * "Catalyst | Clothing | SAMS" reports had no project). The theme is added hidden from the Theme Store lists (not live), its Theme Design &
 * Development project is created, and the flagged Chat reports that name it are re-read, which links them to the theme and puts their
 * posters on the project's team (the same as pressing Re-check on the Chat page).
 *
 *   npx tsx --env-file=.env.production.local scripts/add-new-theme.ts Catalyst --portal SAMS --status under_designing           # dry run
 *   npx tsx --env-file=.env.production.local scripts/add-new-theme.ts Catalyst --portal SAMS --status under_designing --apply   # writes (owner runs it)
 *
 * Defaults: portal SAMS, status under_designing. A theme or project that already exists is left alone. No Theme Store listing or
 * GA4 row is created (the theme isn't on the Theme Store yet).
 */
import { connectToDatabase } from "../lib/db/connect";
import { reprocessFlaggedReports } from "../lib/chat/importReports";
import { PORTALS, PROJECT_STATUSES } from "../lib/projects/constants";
import { AdminAudit } from "../models/admin-audit";
import { ChatReport } from "../models/chat-report";
import { Project } from "../models/project";
import { Theme } from "../models/theme";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const themeName = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  const portal = option("portal") ?? "SAMS";
  const status = option("status") ?? "under_designing";
  if (!themeName) throw new Error('Usage: add-new-theme.ts "<Theme name>" [--portal SAMS] [--status under_designing] [--apply]');
  if (!(PORTALS as readonly string[]).includes(portal)) throw new Error(`--portal must be one of: ${PORTALS.join(", ")}`);
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) throw new Error(`--status must be one of: ${PROJECT_STATUSES.join(", ")}`);

  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  let theme = await Theme.findOne({ name: new RegExp(`^${themeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).select("_id name").lean<{ _id: unknown; name: string }>();
  console.log(theme ? `Theme "${theme.name}" exists.` : `${apply ? "Creating" : "Would create"} theme "${themeName}" (not live, so it shows under "Under development").`);
  if (!theme && apply) {
    const created = await Theme.create({ name: themeName, themeStoreLive: false });
    theme = { _id: created._id, name: created.name };
  }

  const projectExists = theme ? await Project.exists({ themeId: theme._id, name: theme.name }) : false;
  console.log(projectExists ? `Project "${theme?.name}" exists.` : `${apply ? "Creating" : "Would create"} project "${themeName}": Theme Design & Development, portal ${portal}, status ${status}.`);
  if (!projectExists && apply && theme) {
    await Project.create({ themeId: theme._id, name: theme.name, type: "theme_development", status, portal });
    await AdminAudit.create({ action: "projects.add", detail: { themeId: String(theme._id), themeName: theme.name, project: theme.name, type: "theme_development", portal, status } });
  }

  // The reports that name this theme and are waiting for it.
  const re = new RegExp(`theme\\s*name\\s*[:\\-–—]*\\s*${themeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const waiting = (await ChatReport.find({ status: "needs_review", locked: { $ne: true } }).select("sender date minutes rawText").lean<{ sender: string; date: Date; minutes: number; rawText: string }[]>()).filter((r) => re.test(r.rawText));
  const hours = waiting.reduce((n, r) => n + r.minutes, 0) / 60;
  console.log(`\n${waiting.length} flagged report(s) name "${themeName}" (${hours.toFixed(1)} h, ${(hours / 8.5).toFixed(1)} days):`);
  for (const r of waiting) console.log(`  ${new Date(r.date).toISOString().slice(0, 10)}  ${r.sender || "?"}  ${(r.minutes / 60).toFixed(1)} h`);

  if (!apply) {
    console.log("\nDry run: nothing written. Pass --apply to create them and attach the reports.");
    return;
  }
  const summary = await reprocessFlaggedReports();
  console.log(`\nRe-checked the flagged reports: ${summary.fixed} now resolved, ${summary.stillNeedsReview.length} still need review.`);
  if (summary.stillNeedsReview.length) {
    console.log("Still flagged (open the Chat page to see why):");
    for (const r of summary.stillNeedsReview.slice(0, 10)) console.log(`  - ${r.reason.slice(0, 140)}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
