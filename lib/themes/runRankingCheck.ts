import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeRankingCheckState } from "@/models/theme-ranking-check-state";
import { findThemeStoreRankings } from "@/lib/demoStore/themeStoreRanking";

export type RankingCheckResult = { ok: true; checked: number } | { ok: false; error: string };

/**
 * Crawls the public Theme Store catalog for every Theme confirmed listed
 * there (themeStoreSlug resolved successfully via the per-theme "Check
 * Theme Store" action) and stamps its overall catalog position onto the
 * Theme document. The one place that owns this — called by both the
 * daily scheduler and the manual "Check Ranking" button, same split as
 * lib/demoStore/runCheck.ts. A crawl failure (the whole catalog walk
 * throws, e.g. a network blip) is recorded as lastError without
 * touching any Theme's existing rank — better to keep yesterday's known
 * rank than overwrite it with nothing.
 */
export async function runThemeStoreRankingCheck(): Promise<RankingCheckResult> {
  await connectToDatabase();
  const now = new Date();

  const listed = await Theme.find({ themeStoreSlug: { $ne: null }, themeStoreCheckedAt: { $ne: null }, themeStoreError: null }).select(
    "themeStoreSlug"
  );

  if (listed.length === 0) {
    await ThemeRankingCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: null }, { upsert: true });
    return { ok: true, checked: 0 };
  }

  try {
    const slugs = listed.map((t) => t.themeStoreSlug as string);
    const rankings = await findThemeStoreRankings(slugs);

    await Promise.all(
      listed.map((theme) => {
        const found = rankings.get(theme.themeStoreSlug as string) ?? null;
        theme.themeStoreRank = found?.rank ?? null;
        theme.themeStoreRankPage = found?.page ?? null;
        theme.themeStoreRankCheckedAt = now;
        return theme.save();
      })
    );

    await ThemeRankingCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: null }, { upsert: true });
    return { ok: true, checked: listed.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to crawl the Theme Store.";
    await ThemeRankingCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: error }, { upsert: true });
    return { ok: false, error };
  }
}
