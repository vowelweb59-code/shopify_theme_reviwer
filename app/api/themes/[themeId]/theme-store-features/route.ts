import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
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
    theme.themeStorePresets = result.presets;
    theme.themeStoreError = null;
    theme.themeStoreVersion = result.latestVersion;
    const releasedAt = result.latestVersionReleasedAt ? new Date(result.latestVersionReleasedAt) : null;
    theme.themeStoreVersionReleasedAt = releasedAt && !Number.isNaN(releasedAt.getTime()) ? releasedAt : null;
  } else {
    theme.themeStoreError = result.error;
  }
  await theme.save();

  return NextResponse.json({ theme });
}
