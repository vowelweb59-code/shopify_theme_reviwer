import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { DemoStoreThemeRecord } from "@/models/demo-store-theme-record";
import { findThemeStoreRankings } from "@/lib/demoStore/themeStoreRanking";

/**
 * Crawls the public Theme Store catalog for every demo-store-tracked
 * theme that's confirmed listed there, and stamps its overall catalog
 * position onto every history record sharing that theme id. Deliberately
 * a separate, manual action from the daily demo-store check — finding a
 * rank can mean walking dozens of listing pages, too slow/impolite to run
 * on an automatic schedule.
 */
export async function POST() {
  await connectToDatabase();

  const listed = await DemoStoreThemeRecord.find({ themeStoreListed: true, themeStoreSlug: { $ne: null } })
    .sort({ startedAt: -1 })
    .select("shopifyThemeId themeStoreSlug");

  const slugByThemeId = new Map<number, string>();
  for (const record of listed) {
    if (!slugByThemeId.has(record.shopifyThemeId)) {
      slugByThemeId.set(record.shopifyThemeId, record.themeStoreSlug!);
    }
  }

  if (slugByThemeId.size === 0) {
    return NextResponse.json({ ok: true, checked: 0 });
  }

  try {
    const rankings = await findThemeStoreRankings([...slugByThemeId.values()]);
    const now = new Date();

    for (const [shopifyThemeId, slug] of slugByThemeId) {
      const found = rankings.get(slug) ?? null;
      await DemoStoreThemeRecord.updateMany(
        { shopifyThemeId },
        { themeStoreRank: found?.rank ?? null, themeStoreRankPage: found?.page ?? null, themeStoreRankCheckedAt: now }
      );
    }

    return NextResponse.json({ ok: true, checked: slugByThemeId.size });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to crawl the Theme Store." }, { status: 502 });
  }
}
