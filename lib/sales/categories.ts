import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { INDUSTRIES } from "@/lib/themes/industries";
import { runFilteredRankingCheck } from "@/lib/themes/runFilteredRankingCheck";
import { PresetCategory } from "@/models/preset-category";
import { Theme } from "@/models/theme";
import { ThemeFilteredRank } from "@/models/theme-filtered-rank";
import { ThemeRankingFilter } from "@/models/theme-ranking-filter";
import { presetNamesFor } from "./presetNames";

// Each preset's one main Theme Store category (the user's choice), using
// the same source as the Theme ranking tab: which industry collections a
// preset shows up in when the Theme Store is filtered by that industry.
// The suggestion is the collection where it ranks best; the user can
// override it on the Sales page.

export type PresetCategoryRow = {
  themeId: string;
  themeName: string;
  presetName: string;
  /** Every category the preset is listed in, best rank first. */
  listedIn: { industry: string; rank: number }[];
  suggested: string | null;
  manual: string | null;
  category: string | null;
};

/** Recomputes suggestions from the stored crawl results; keeps manual choices. */
export async function refreshSuggestions(): Promise<void> {
  await connectToDatabase();
  const filters = await ThemeRankingFilter.find({ industry: { $ne: null } }).select("_id industry").lean<{ _id: unknown; industry: string }[]>();
  const industryByFilter = new Map(filters.map((f) => [String(f._id), f.industry]));
  const ranks = await ThemeFilteredRank.find({ filterId: { $in: filters.map((f) => f._id) } })
    .select("filterId themeId presetName rank")
    .lean<{ filterId: unknown; themeId: unknown; presetName: string; rank: number }[]>();

  const best = new Map<string, { themeId: string; presetName: string; industry: string; rank: number }>();
  for (const r of ranks) {
    const industry = industryByFilter.get(String(r.filterId));
    if (!industry) continue;
    const key = `${r.themeId}|${r.presetName.toLowerCase()}`;
    const current = best.get(key);
    if (!current || r.rank < current.rank) best.set(key, { themeId: String(r.themeId), presetName: r.presetName, industry, rank: r.rank });
  }
  if (best.size === 0) return;
  await PresetCategory.bulkWrite(
    [...best.values()].map((b) => ({
      updateOne: { filter: { themeId: b.themeId, presetName: b.presetName }, update: { $set: { suggested: b.industry } }, upsert: true },
    }))
  );
}

export async function listPresetCategories(themeIds?: string[]): Promise<PresetCategoryRow[]> {
  await connectToDatabase();
  const themes = await Theme.find(themeIds ? { _id: { $in: themeIds } } : {})
    .select("name themeStorePresets")
    .sort({ name: 1 })
    .lean<{ _id: unknown; name: string; themeStorePresets?: { name: string }[] }[]>();
  const [stored, filters] = await Promise.all([
    PresetCategory.find({ themeId: { $in: themes.map((t) => t._id) } }).lean<{ themeId: unknown; presetName: string; suggested: string | null; manual: string | null }[]>(),
    ThemeRankingFilter.find({ industry: { $ne: null } }).select("_id industry").lean<{ _id: unknown; industry: string }[]>(),
  ]);
  const industryByFilter = new Map(filters.map((f) => [String(f._id), f.industry]));
  const ranks = await ThemeFilteredRank.find({ filterId: { $in: filters.map((f) => f._id) }, themeId: { $in: themes.map((t) => t._id) } })
    .select("filterId themeId presetName rank")
    .lean<{ filterId: unknown; themeId: unknown; presetName: string; rank: number }[]>();

  const byKey = new Map(stored.map((s) => [`${s.themeId}|${s.presetName.toLowerCase()}`, s]));
  const rows: PresetCategoryRow[] = [];
  for (const t of themes) {
    for (const presetName of presetNamesFor(t)) {
      const key = `${t._id}|${presetName.toLowerCase()}`;
      const s = byKey.get(key);
      const listed = new Map<string, number>();
      for (const r of ranks) {
        if (String(r.themeId) !== String(t._id) || r.presetName.toLowerCase() !== presetName.toLowerCase()) continue;
        const industry = industryByFilter.get(String(r.filterId));
        if (industry && (!listed.has(industry) || r.rank < listed.get(industry)!)) listed.set(industry, r.rank);
      }
      const listedIn = [...listed].map(([industry, rank]) => ({ industry, rank })).sort((a, b) => a.rank - b.rank);
      // The stored suggestion is only written after a full category crawl;
      // until then the best listing from the ranking data is the suggestion.
      const suggested = s?.suggested ?? listedIn[0]?.industry ?? null;
      rows.push({
        themeId: String(t._id),
        themeName: t.name,
        presetName,
        listedIn,
        suggested,
        manual: s?.manual ?? null,
        category: s?.manual ?? suggested,
      });
    }
  }
  return rows;
}

export async function setManualCategory(themeId: string, presetName: string, industry: string | null): Promise<void> {
  await connectToDatabase();
  await PresetCategory.updateOne({ themeId, presetName }, { $set: { manual: industry } }, { upsert: true });
}

// --- Crawling every category once ------------------------------------------

type CrawlState = { running: Promise<void> | null; total: number; done: number; current: string | null; errors: string[] };
const g = globalThis as typeof globalThis & { _salesCategoryCrawl?: CrawlState };
const crawl = (g._salesCategoryCrawl ??= { running: null, total: 0, done: 0, current: null, errors: [] });

export function categoryCrawlProgress() {
  return { running: crawl.running !== null, total: crawl.total, done: crawl.done, current: crawl.current, errors: crawl.errors };
}

const FRESH_MS = 20 * 60 * 60 * 1000;
const PAUSE_BETWEEN_CATEGORIES_MS = 20_000;
const RATE_LIMIT_WAIT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes sure every Theme Store category is tracked (relevance sort — these
 * then stay fresh through the ranking tab's existing daily re-crawl) and
 * crawls the ones not checked in the last ~day, one at a time, then
 * refreshes the suggestions. Runs in the background.
 */
export function startCategoryCrawl(): void {
  if (crawl.running) return;
  crawl.errors = [];
  crawl.running = (async () => {
    await connectToDatabase();
    for (const { slug } of INDUSTRIES) {
      await ThemeRankingFilter.updateOne({ sortBy: "relevance", industry: slug }, { $setOnInsert: { sortBy: "relevance", industry: slug } }, { upsert: true });
    }
    const filters = await ThemeRankingFilter.find({ sortBy: "relevance", industry: { $in: INDUSTRIES.map((i) => i.slug) } });
    // A failed crawl still sets lastCheckedAt, so an error also counts as stale.
    const stale = filters.filter((f) => f.lastError || !f.lastCheckedAt || Date.now() - new Date(f.lastCheckedAt).getTime() > FRESH_MS);
    crawl.total = stale.length;
    crawl.done = 0;
    for (const [i, filter] of stale.entries()) {
      crawl.current = filter.industry;
      // Back-to-back crawls get rate-limited by themes.shopify.com (429 after
      // ~9 categories, seen 2026-09-29), so pause between categories and wait
      // longer before one retry when it does happen.
      if (i > 0) await sleep(PAUSE_BETWEEN_CATEGORIES_MS);
      let result = await runFilteredRankingCheck(filter);
      if (!result.ok && /\b429\b/.test(result.error)) {
        await sleep(RATE_LIMIT_WAIT_MS);
        result = await runFilteredRankingCheck(filter);
      }
      if (!result.ok) crawl.errors.push(`${filter.industry}: ${result.error}`);
      crawl.done++;
    }
    crawl.current = null;
    await refreshSuggestions();
  })()
    .catch((err) => {
      console.error("[sales] category crawl failed:", err);
      crawl.errors.push(err instanceof Error ? err.message : String(err));
    })
    .finally(() => {
      crawl.running = null;
    });
}
