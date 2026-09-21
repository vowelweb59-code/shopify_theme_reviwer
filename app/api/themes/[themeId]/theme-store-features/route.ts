import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeRankHistory } from "@/models/theme-rank-history";
import { fetchThemeStoreFeatureLabels } from "@/lib/themes/themeStoreFeatures";

/**
 * Fetches this theme's public Shopify Theme Store listing (URL derived
 * from the theme's name) and caches the feature names it advertises onto
 * the Theme document — used to fill in AVAILABLE_FEATURES entries our own
 * static/live detectors have no way to check. A deliberate, on-request
 * action (not run automatically on every page load or audit): it's a live
 * fetch of an external page, and Theme Store listings don't change often
 * enough to justify re-checking them that eagerly.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;

  const theme = await Theme.findById(themeId);
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }

  const result = await fetchThemeStoreFeatureLabels(theme.name);
  theme.themeStoreSlug = result.slug;
  theme.themeStoreCheckedAt = new Date();
  if (result.ok) {
    theme.themeStoreFeatures = result.features;
    // Re-derive the preset list (a theme can add/rename/drop presets over
    // time) but preserve rank/page/previousRank for any slug that still
    // exists — those come from the separate "Check Ranking" crawl, not
    // this fetch, and blindly overwriting with fresh {name, slug} objects
    // would silently wipe out already-crawled ranking data on every
    // re-check.
    type ExistingPreset = { rank: number | null; page: number | null; previousRank: number | null };
    const existingPresetsBySlug = new Map<string, ExistingPreset>(
      (theme.themeStorePresets ?? []).map((p: { slug: string } & ExistingPreset) => [p.slug, p])
    );
    theme.themeStorePresets = result.presets.map((p) => {
      const existing = existingPresetsBySlug.get(p.slug);
      return { name: p.name, slug: p.slug, rank: existing?.rank ?? null, page: existing?.page ?? null, previousRank: existing?.previousRank ?? null };
    });
    theme.themeStorePreviousReviewCount = theme.themeStoreReviewCount;
    theme.themeStoreReviewCount = result.reviewCount;
    theme.themeStorePositivePercent = result.positivePercent;
    theme.themeStoreError = null;
    theme.themeStoreVersion = result.latestVersion;
    const releasedAt = result.latestVersionReleasedAt ? new Date(result.latestVersionReleasedAt) : null;
    theme.themeStoreVersionReleasedAt = releasedAt && !Number.isNaN(releasedAt.getTime()) ? releasedAt : null;
  } else {
    theme.themeStoreError = result.error;
  }
  await theme.save();

  // A review-count/rating snapshot for the ranking-history charts — see
  // models/theme-rank-history.ts. Only on a successful check with a
  // resolved slug; an error means nothing new was actually observed.
  if (result.ok) {
    await ThemeRankHistory.create({
      themeId: theme._id,
      presetSlug: result.slug,
      presetName: theme.name,
      reviewCount: result.reviewCount,
      positivePercent: result.positivePercent,
      checkedAt: theme.themeStoreCheckedAt,
    });
  }

  return NextResponse.json({ theme });
}
