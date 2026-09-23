import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { fetchPresetDemoStoreUrls } from "@/lib/themes/themeStoreFeatures";

/**
 * Powers the Presets editor's "Autofetch" action: pulls each of this
 * theme's known Theme Store presets' live demo store URLs straight from
 * themes.shopify.com instead of the merchant copying each one in by hand.
 * Relies on themeStoreSlug/themeStorePresets, which only exist once the
 * per-theme "Check Theme Store" action (see ../theme-store-features) has
 * resolved this theme's listing — there's nothing to autofetch from
 * before that. Read-only: returns the fetched {label, url} pairs for the
 * client to drop into its draft, same as it would if the merchant had
 * typed them in; saving them onto the theme is still a separate "Save
 * presets" action.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;

  const theme = await Theme.findById(themeId).select("themeStoreSlug themeStorePresets");
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }
  if (!theme.themeStoreSlug || !theme.themeStorePresets || theme.themeStorePresets.length === 0) {
    return NextResponse.json(
      { error: "Run “Check Theme Store” on this theme first — that's what resolves the Theme Store presets to fetch demo URLs for." },
      { status: 400 }
    );
  }

  const results = await fetchPresetDemoStoreUrls(
    theme.themeStoreSlug,
    theme.themeStorePresets.map((p: { name: string; slug: string }) => ({ name: p.name, slug: p.slug }))
  );

  return NextResponse.json({
    presets: results.map((r) => ({ label: r.name, url: r.url ?? "" })),
    errors: results.filter((r) => r.error).map((r) => `${r.name}: ${r.error}`),
  });
}
