/**
 * One-off: saves the Git repo URL of themes whose repo is known (Theme.gitRepoUrl, same as the "Code source" card).
 * Add a line to REPOS when another repo is known and run it again. A theme that already has a URL is left alone.
 *
 *   npx tsx --env-file=.env.production.local scripts/set-git-urls.ts          # dry run
 *   npx tsx --env-file=.env.production.local scripts/set-git-urls.ts --apply  # writes (owner runs it)
 */
import { connectToDatabase } from "../lib/db/connect";
import { Theme } from "../models/theme";

const apply = process.argv.includes("--apply");

const REPOS: Record<string, string> = {
  Adorn: "https://github.com/vowelwebsupport/Adorn",
  Dynamic: "https://github.com/vowelwebsupport/Dynamic",
  Flaunt: "https://github.com/vowelwebsupport/Flaunt",
  Renovate: "https://github.com/vowelwebsupport/Renovate",
  Voltix: "https://github.com/vowelwebsupport/Voltix",
};

async function main() {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);
  for (const [name, url] of Object.entries(REPOS)) {
    const theme = await Theme.findOne({ name }).select("gitRepoUrl").lean<{ gitRepoUrl?: string | null }>();
    if (!theme) { console.log(`${name}: theme not found, skipped`); continue; }
    if (theme.gitRepoUrl) { console.log(`${name}: already has ${theme.gitRepoUrl}, skipped`); continue; }
    console.log(`${name}: ${apply ? "saving" : "would save"} ${url}`);
    if (apply) await Theme.updateOne({ name }, { $set: { gitRepoUrl: url } });
  }
  if (!apply) console.log("\nDry run: nothing written. Pass --apply to save.");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
