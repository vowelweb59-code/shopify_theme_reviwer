import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeRankingCheckState } from "@/models/theme-ranking-check-state";
import { ThemeRankHistory } from "@/models/theme-rank-history";
import { findThemeStoreRankings } from "@/lib/demoStore/themeStoreRanking";

export type RankingCheckResult = { ok: true; checked: number } | { ok: false; error: string };

/**
 * Crawls the public Theme Store catalog for every Theme confirmed listed
 * there (themeStoreSlug resolved successfully via the per-theme "Check
 * Theme Store" action) and stamps its own default listing's overall
 * catalog position onto the Theme document, plus each of its known
 * alternate presets' own position (themeStorePresets[].rank/page) — a
 * multi-preset theme gets a separately-ranked card per preset (confirmed
 * live), so those aren't derived from the theme's rank, they're looked
 * up independently in the same crawl pass. The one place that owns
 * this — called by both the daily scheduler and the manual "Check
 * Ranking" button, same split as lib/demoStore/runCheck.ts. Before
 * overwriting, shifts each theme's (and preset's) current rank into
 * previousRank, so the UI can show how much it moved since the last
 * check. A crawl failure (the whole catalog walk throws, e.g. a network
 * blip) is recorded as lastError without touching any Theme's existing
 * rank — better to keep yesterday's known rank than overwrite it with
 * nothing. Also appends one models/theme-rank-history.ts row per theme
 * (and per preset) to this crawl's own findings — the append-only log
 * behind the ranking-history charts, distinct from the Theme document's
 * own single-prior-value previousRank fields.
 */
export async function runThemeStoreRankingCheck(): Promise<RankingCheckResult> {
  await connectToDatabase();
  const now = new Date();

  const listed = await Theme.find({ themeStoreSlug: { $ne: null }, themeStoreCheckedAt: { $ne: null }, themeStoreError: null }).select(
    "name themeStoreSlug themeStorePresets themeStoreRank themeStoreRankPage"
  );

  if (listed.length === 0) {
    await ThemeRankingCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: null }, { upsert: true });
    return { ok: true, checked: 0 };
  }

  try {
    const targets = new Map<string, Set<string>>();
    for (const theme of listed) {
      const slug = theme.themeStoreSlug as string;
      const presetSlugs = (theme.themeStorePresets ?? []).map((p: { slug: string }) => p.slug);
      targets.set(slug, new Set([slug, ...presetSlugs]));
    }

    const rankings = await findThemeStoreRankings(targets);
    const historyRows: {
      themeId: unknown;
      presetSlug: string;
      presetName: string;
      rank: number | null;
      page: number | null;
      checkedAt: Date;
    }[] = [];

    await Promise.all(
      listed.map((theme) => {
        const slug = theme.themeStoreSlug as string;
        const found = rankings.get(slug) ?? [];
        const ownListing = found.find((f) => f.presetSlug === slug);
        theme.themeStorePreviousRank = theme.themeStoreRank;
        theme.themeStoreRank = ownListing?.rank ?? null;
        theme.themeStoreRankPage = ownListing?.page ?? null;
        theme.themeStoreRankCheckedAt = now;
        historyRows.push({
          themeId: theme._id,
          presetSlug: slug,
          presetName: theme.name,
          rank: theme.themeStoreRank,
          page: theme.themeStoreRankPage,
          checkedAt: now,
        });
        if (theme.themeStorePresets) {
          for (const preset of theme.themeStorePresets) {
            const match = found.find((f) => f.presetSlug === preset.slug);
            preset.previousRank = preset.rank;
            preset.rank = match?.rank ?? null;
            preset.page = match?.page ?? null;
            historyRows.push({
              themeId: theme._id,
              presetSlug: preset.slug,
              presetName: preset.name,
              rank: preset.rank,
              page: preset.page,
              checkedAt: now,
            });
          }
        }
        return theme.save();
      })
    );

    if (historyRows.length > 0) await ThemeRankHistory.insertMany(historyRows);

    await ThemeRankingCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: null }, { upsert: true });
    return { ok: true, checked: listed.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to crawl the Theme Store.";
    await ThemeRankingCheckState.findOneAndUpdate({}, { lastCheckedAt: now, lastError: error }, { upsert: true });
    return { ok: false, error };
  }
}
