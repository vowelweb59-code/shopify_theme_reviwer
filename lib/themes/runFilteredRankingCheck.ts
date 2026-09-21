import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeRankingFilter, type ThemeRankingFilterDoc } from "@/models/theme-ranking-filter";
import { ThemeFilteredRank } from "@/models/theme-filtered-rank";
import { findThemeStoreRankings } from "@/lib/demoStore/themeStoreRanking";
import type { HydratedDocument } from "mongoose";

export type FilteredRankingCheckResult = { ok: true; matched: number } | { ok: false; error: string };

/**
 * Crawls the catalog under one tracked filter (Sort + Collection) and
 * upserts models/theme-filtered-rank.ts rows for every theme/preset
 * actually found under it — a listing that doesn't belong to this
 * filter's category simply gets no row, which is exactly what "only show
 * presets of that category" needs downstream. A listing that WAS
 * matched last time but isn't found this time (dropped from the
 * category, or the crawl just didn't reach it) has its row removed, so
 * stale matches don't linger.
 */
export async function runFilteredRankingCheck(filter: HydratedDocument<ThemeRankingFilterDoc>): Promise<FilteredRankingCheckResult> {
  await connectToDatabase();
  const now = new Date();

  const listed = await Theme.find({ themeStoreSlug: { $ne: null }, themeStoreCheckedAt: { $ne: null }, themeStoreError: null }).select(
    "name themeStoreSlug themeStorePresets"
  );

  try {
    const targets = new Map<string, Set<string>>();
    for (const theme of listed) {
      const slug = theme.themeStoreSlug as string;
      const presetSlugs = (theme.themeStorePresets ?? []).map((p: { slug: string }) => p.slug);
      targets.set(slug, new Set([slug, ...presetSlugs]));
    }

    const rankings = await findThemeStoreRankings(targets, { sortBy: filter.sortBy as "relevance" | "newest", industry: filter.industry });

    const existing = await ThemeFilteredRank.find({ filterId: filter._id }).select("themeId presetSlug rank");
    const existingByKey = new Map(existing.map((e) => [`${e.themeId}/${e.presetSlug}`, e]));
    const matchedKeys = new Set<string>();

    for (const theme of listed) {
      const slug = theme.themeStoreSlug as string;
      const found = rankings.get(slug) ?? [];
      const presetNameBySlug = new Map<string, string>([[slug, theme.name], ...(theme.themeStorePresets ?? []).map((p: { slug: string; name: string }) => [p.slug, p.name] as const)]);
      for (const entry of found) {
        const key = `${theme._id}/${entry.presetSlug}`;
        matchedKeys.add(key);
        const previous = existingByKey.get(key);
        await ThemeFilteredRank.findOneAndUpdate(
          { filterId: filter._id, themeId: theme._id, presetSlug: entry.presetSlug },
          {
            presetName: presetNameBySlug.get(entry.presetSlug) ?? entry.presetSlug,
            rank: entry.rank,
            page: entry.page,
            previousRank: previous?.rank ?? null,
            checkedAt: now,
          },
          { upsert: true }
        );
      }
    }

    const staleKeys = [...existingByKey.keys()].filter((k) => !matchedKeys.has(k));
    if (staleKeys.length > 0) {
      await ThemeFilteredRank.deleteMany({
        filterId: filter._id,
        $or: staleKeys.map((k) => {
          const [themeId, presetSlug] = k.split("/");
          return { themeId, presetSlug };
        }),
      });
    }

    filter.lastCheckedAt = now;
    filter.lastError = null;
    await filter.save();
    return { ok: true, matched: matchedKeys.size };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to crawl the Theme Store.";
    filter.lastCheckedAt = now;
    filter.lastError = error;
    await filter.save();
    return { ok: false, error };
  }
}

/** Runs every tracked filter combination once — called by the daily scheduler after the default crawl. */
export async function runAllTrackedFilteredRankingChecks(): Promise<void> {
  await connectToDatabase();
  const filters = await ThemeRankingFilter.find();
  for (const filter of filters) {
    try {
      await runFilteredRankingCheck(filter);
    } catch (err) {
      console.error("[theme-ranking-filter] scheduled check failed:", err);
    }
  }
}
