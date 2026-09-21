import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { findThemeStoreRankings } from "@/lib/demoStore/themeStoreRanking";

/**
 * Crawls the public Theme Store catalog for every Theme confirmed listed
 * there (themeStoreSlug resolved successfully via the "Check Theme
 * Store" action — see app/api/themes/[themeId]/theme-store-features) and
 * stamps its overall catalog position onto the Theme document.
 * Deliberately a separate, manual action — finding a rank can mean
 * walking dozens of listing pages, too slow/impolite to run on every
 * "Check Theme Store" click.
 */
export async function POST() {
  await connectToDatabase();

  const listed = await Theme.find({ themeStoreSlug: { $ne: null }, themeStoreCheckedAt: { $ne: null }, themeStoreError: null }).select(
    "themeStoreSlug"
  );

  if (listed.length === 0) {
    return NextResponse.json({ ok: true, checked: 0 });
  }

  try {
    const slugs = listed.map((t) => t.themeStoreSlug as string);
    const rankings = await findThemeStoreRankings(slugs);
    const now = new Date();

    await Promise.all(
      listed.map((theme) => {
        const found = rankings.get(theme.themeStoreSlug as string) ?? null;
        theme.themeStoreRank = found?.rank ?? null;
        theme.themeStoreRankPage = found?.page ?? null;
        theme.themeStoreRankCheckedAt = now;
        return theme.save();
      })
    );

    return NextResponse.json({ ok: true, checked: listed.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to crawl the Theme Store." }, { status: 502 });
  }
}
