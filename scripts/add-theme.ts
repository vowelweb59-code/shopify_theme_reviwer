/**
 * Adds a new theme to the app everywhere it needs to exist, in one idempotent step:
 *   - the theme itself (Themes, Projects, Sales and Chat time reports all match on this row);
 *   - its public Shopify Theme Store listing: slug, presets, features, review count, and the first rank-history snapshot
 *     (the same "Check Theme Store" the Themes page runs);
 *   - its Analytics theme row (unmapped; map it to its GA4 property in Settings > GA4 Analytics, or leave an existing mapping alone),
 *     linked to the theme so audit and analytics show together.
 *
 *   npm run theme:add -- Rare             # dry run: shows what would be added, changes nothing
 *   npm run theme:add -- Rare --apply     # does it
 *
 * Runs against whatever database MONGODB_URI points at. For the live database load its env file:
 *   npx tsx --env-file=.env.production.local scripts/add-theme.ts Rare [--apply]
 * Safe to run again: anything that already exists is left as it is (a re-run only refreshes the Theme Store listing).
 */
import { connectToDatabase } from "../lib/db/connect";
import { slugify } from "../lib/analytics/slug";
import { fetchThemeStoreFeatureLabels } from "../lib/themes/themeStoreFeatures";
import { POST as checkThemeStore } from "../app/api/themes/[themeId]/theme-store-features/route";
import { AnalyticsTheme } from "../models/analytics-theme";
import { Theme } from "../models/theme";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const name = args.find((a) => !a.startsWith("--"))?.trim();
if (!name) {
  console.error('Usage: npm run theme:add -- "<Theme name>" [--apply]');
  process.exit(1);
}

async function main(themeName: string) {
  const mongoose = await connectToDatabase();
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const escaped = themeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let theme = await Theme.findOne({ name: new RegExp(`^${escaped}$`, "i") });
  console.log(theme ? `Theme: "${theme.name}" already exists.` : `Theme: "${themeName}" will be created.`);

  const listing = await fetchThemeStoreFeatureLabels(theme?.name ?? themeName);
  if (listing.ok) {
    console.log(`Theme Store: themes.shopify.com/themes/${listing.slug} found. ${listing.presets.length} presets (${listing.presets.map((p) => p.name).join(", ")}), ${listing.features.length} features, ${listing.reviewCount ?? "no"} reviews.`);
  } else {
    console.log(`Theme Store: not read (${listing.error})`);
  }

  const slug = slugify(theme?.name ?? themeName);
  const analytics = await AnalyticsTheme.findOne({ slug });
  console.log(analytics ? `Analytics: "${analytics.name}" already exists${analytics.ga4PropertyId ? ` (GA4 property ${analytics.ga4PropertyId}${analytics.pagePathPrefix ? `, pages ${analytics.pagePathPrefix}` : ""})` : ", not mapped to a GA4 property yet"}.` : `Analytics: "${themeName}" will be created, unmapped.`);

  if (!apply) return console.log("\nDry run: nothing written. Pass --apply to do it.");

  if (!theme) {
    theme = await Theme.create({ name: themeName });
    console.log(`\nCreated theme "${theme.name}".`);
  }
  if (!analytics) {
    await AnalyticsTheme.create({ name: theme.name, slug, themeId: theme._id });
    console.log(`Created analytics theme "${theme.name}" (map it to its GA4 property in Settings > GA4 Analytics).`);
  } else if (!analytics.themeId) {
    await AnalyticsTheme.updateOne({ _id: analytics._id }, { $set: { themeId: theme._id } });
    console.log(`Linked analytics theme "${analytics.name}" to the theme.`);
  }

  const res = await checkThemeStore(new Request("http://localhost"), { params: Promise.resolve({ themeId: theme._id.toString() }) });
  const body = (await res.json()) as { theme?: { themeStoreError?: string | null; themeStorePresets?: { name: string }[] }; error?: string };
  if (!res.ok) console.log(`Theme Store check failed: ${body.error ?? res.status}`);
  else if (body.theme?.themeStoreError) console.log(`Theme Store check: ${body.theme.themeStoreError}`);
  else console.log(`Theme Store listing saved: ${body.theme?.themeStorePresets?.length ?? 0} presets. Rankings fill in on the next ranking check.`);
}

main(name)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
