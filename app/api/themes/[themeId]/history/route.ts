import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeRankHistory } from "@/models/theme-rank-history";

/**
 * The time series behind /themes/[themeId]/ranking's two charts. Reads
 * from models/theme-rank-history.ts's append-only log (not the Theme
 * document's own single-prior-value previousRank/previousReviewCount
 * fields, which only ever hold one comparison point) and groups it into
 * one rank series per known slug (the theme's own default listing plus
 * every preset) and one review-count series (theme-wide, not
 * preset-specific).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;

  const theme = await Theme.findById(themeId).select("name themeStoreSlug themeStorePresets");
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }

  const rows = await ThemeRankHistory.find({ themeId }).sort({ checkedAt: 1 }).lean();

  type RankPoint = { date: string; rank: number; page: number | null };
  type RankEntry = { name: string; points: RankPoint[] };
  const rankBySlug = new Map<string, RankEntry>();
  const reviewPoints: { date: string; reviewCount: number; positivePercent: number | null }[] = [];

  for (const row of rows) {
    if (row.rank != null) {
      const entry: RankEntry = rankBySlug.get(row.presetSlug) ?? { name: row.presetName, points: [] };
      entry.name = row.presetName;
      entry.points.push({ date: row.checkedAt.toISOString(), rank: row.rank, page: row.page ?? null });
      rankBySlug.set(row.presetSlug, entry);
    }
    if (row.reviewCount != null) {
      reviewPoints.push({ date: row.checkedAt.toISOString(), reviewCount: row.reviewCount, positivePercent: row.positivePercent ?? null });
    }
  }

  // The base listing first (fixed series-1 color slot), then presets in
  // the theme's own current order — a slug with history that's since been
  // renamed/dropped from the live preset list still gets shown, just
  // appended after so it doesn't silently disappear.
  const currentSlugOrder = [theme.themeStoreSlug, ...(theme.themeStorePresets ?? []).map((p: { slug: string }) => p.slug)].filter(
    (slug, idx, arr): slug is string => slug != null && arr.indexOf(slug) === idx
  );
  const rankSeries = currentSlugOrder.filter((slug) => rankBySlug.has(slug)).map((slug) => ({ slug, ...rankBySlug.get(slug)! }));
  for (const [slug, entry] of rankBySlug) {
    if (!currentSlugOrder.includes(slug)) rankSeries.push({ slug, ...entry });
  }

  return NextResponse.json({
    theme: { name: theme.name, slug: theme.themeStoreSlug },
    rankSeries,
    reviewSeries: reviewPoints,
  });
}
