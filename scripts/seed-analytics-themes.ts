// Idempotent seed of the GA4 analytics themes that exist today. Rows, not
// code, define themes (see models/analytics-theme.ts), so this list is only
// a starting point: anything added later goes through Settings → GA4
// Analytics → Add theme, and re-running this never changes an existing
// theme's name or GA4 mapping. It only fills in a missing link to the
// audited theme of the same name.
//
// Run with: npm run seed:analytics-themes

import { connectToDatabase } from "../lib/db/connect";
import { AnalyticsTheme } from "../models/analytics-theme";
import { Theme } from "../models/theme";
import { slugify } from "../lib/analytics/slug";

const INITIAL_THEMES = ["Adorn", "Dynamic", "Flaunt", "Gravity", "Nexus", "Noble", "Soft", "Zeal", "Renovate"];

async function main() {
  await connectToDatabase();

  const auditThemes = await Theme.find().select("name").lean<{ _id: unknown; name: string }[]>();
  const auditThemeIdBySlug = new Map(auditThemes.map((t) => [slugify(t.name), t._id]));

  let created = 0;
  let linked = 0;
  for (const name of INITIAL_THEMES) {
    const slug = slugify(name);
    const themeId = auditThemeIdBySlug.get(slug) ?? null;
    const result = await AnalyticsTheme.updateOne({ slug }, { $setOnInsert: { name, slug, themeId } }, { upsert: true });
    if (result.upsertedCount > 0) {
      created++;
    } else if (themeId) {
      const link = await AnalyticsTheme.updateOne({ slug, themeId: null }, { $set: { themeId } });
      linked += link.modifiedCount;
    }
  }

  const total = await AnalyticsTheme.countDocuments();
  console.log(`Seed complete: ${created} GA4 theme(s) created, ${linked} newly linked to an audited theme, ${total} total.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
