import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { listPresetCategories } from "@/lib/sales/categories";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";
import { ThemeStoreTheme } from "@/models/theme-store-theme";

/**
 * Each of our themes with its one main Theme Store category and its publisher.
 *  - category: the one chosen by hand on the Sales page, else the category its default preset ranks best in; failing both,
 *    the category the Theme Store catalog lists the theme's own (default) preset under. The catalog crawl records only the
 *    main preset's card, so a single category there is the main preset's; more than one is not trusted (an older crawl).
 *  - publisher: the publisher named on the theme's Theme Store listing, else the portal the theme's project is under.
 */
export async function GET() {
  await connectToDatabase();
  const [themes, presetRows, storeThemes, projects] = await Promise.all([
    Theme.find().select("name").sort({ name: 1 }).lean<{ _id: unknown; name: string }[]>(),
    listPresetCategories(),
    ThemeStoreTheme.find().select("name designer industries").lean<{ name: string; designer: string | null; industries: string[] }[]>(),
    Project.find({ type: { $ne: "theme_update" }, portal: { $ne: null } }).select("themeId portal").lean<{ themeId: unknown; portal: string }[]>(),
  ]);

  // The first row per theme is the main theme's own preset.
  const mainCategory = new Map<string, string | null>();
  for (const r of presetRows) if (!mainCategory.has(r.themeId)) mainCategory.set(r.themeId, r.category);
  const store = new Map(storeThemes.map((s) => [s.name.trim().toLowerCase(), s]));
  const portal = new Map<string, string>();
  for (const p of projects) if (!portal.has(String(p.themeId))) portal.set(String(p.themeId), p.portal);

  return NextResponse.json({
    themes: themes.map((t) => {
      const listing = store.get(t.name.trim().toLowerCase());
      return {
        themeId: String(t._id),
        themeName: t.name,
        category: mainCategory.get(String(t._id)) ?? (listing && listing.industries.length === 1 ? listing.industries[0] : null),
        publisher: listing?.designer ?? portal.get(String(t._id)) ?? null,
      };
    }),
  });
}
