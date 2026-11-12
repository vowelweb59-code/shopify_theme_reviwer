import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeStoreTheme } from "@/models/theme-store-theme";
import { deriveThemeStoreSlug } from "./themeStoreFeatures";
import { ensureDemoPresets } from "./ensurePresets";

/**
 * Copies what the daily Theme Store catalog read (ThemeStoreTheme) knows onto our own Theme rows, so the Themes page needs no
 * "Check Theme Store" click: whether the theme is live, its current version and release date, features, presets and reviews.
 * A theme is live when the catalog has its listing (by the slug saved from an earlier check, else the one derived from its name).
 * Nothing is marked not-live while the catalog is empty (it has never been read). Presets keep the ranks the ranking check wrote.
 * Safe to run any number of times; it never touches a theme's own audit data.
 */
export async function syncThemesFromCatalog({ dryRun = false }: { dryRun?: boolean } = {}): Promise<{ live: number; notLive: number; notLiveThemes: { _id: unknown; name: string }[] }> {
  await connectToDatabase();
  if ((await ThemeStoreTheme.estimatedDocumentCount()) === 0) return { live: 0, notLive: 0, notLiveThemes: [] };
  const notLiveThemes: { _id: unknown; name: string }[] = [];

  const [themes, catalog] = await Promise.all([Theme.find().lean(), ThemeStoreTheme.find().lean()]);
  const bySlug = new Map(catalog.map((c) => [c.slug as string, c]));
  let live = 0;
  let notLive = 0;

  for (const theme of themes) {
    const candidates = [theme.themeStoreSlug, deriveThemeStoreSlug(theme.name)].filter((s): s is string => Boolean(s));
    const match = candidates.map((s) => bySlug.get(s)).find(Boolean);
    if (!match) {
      notLive++;
      notLiveThemes.push({ _id: theme._id, name: theme.name });
      if (!dryRun && theme.themeStoreLive !== false) await Theme.updateOne({ _id: theme._id }, { $set: { themeStoreLive: false } });
      continue;
    }
    live++;

    const set: Record<string, unknown> = { themeStoreLive: true, themeStoreSlug: match.slug };
    if (match.detailAt) {
      set.themeStoreFeatures = match.features ?? [];
      set.themeStoreVersion = match.latestVersion ?? null;
      const released = match.latestVersionReleasedAt ? new Date(match.latestVersionReleasedAt) : null;
      set.themeStoreVersionReleasedAt = released && !Number.isNaN(released.getTime()) ? released : null;
      if (match.reviewCount !== null && match.reviewCount !== undefined && match.reviewCount !== theme.themeStoreReviewCount) {
        set.themeStorePreviousReviewCount = theme.themeStoreReviewCount ?? null;
        set.themeStoreReviewCount = match.reviewCount;
      }
      set.themeStorePositivePercent = match.positivePercent ?? null;
      set.themeStoreError = null;
      set.themeStoreCheckedAt = match.detailAt;
    }
    if (match.presets?.length) {
      type Preset = { slug: string; rank: number | null; page: number | null; previousRank: number | null };
      const existing = new Map<string, Preset>(((theme.themeStorePresets ?? []) as Preset[]).map((p) => [p.slug, p]));
      set.themeStorePresets = match.presets.map((p: { slug: string; name: string }) => {
        const old = existing.get(p.slug);
        return { name: p.name, slug: p.slug, rank: old?.rank ?? null, page: old?.page ?? null, previousRank: old?.previousRank ?? null };
      });
    }
    if (!dryRun) {
      await Theme.updateOne({ _id: theme._id }, { $set: set });
      // A live theme with no demo URLs saved gets them from its listing, so audits and Core Web Vitals have URLs to measure.
      if (!theme.demoStorePresets?.length && match.presets?.length) {
        await ensureDemoPresets({ _id: theme._id, themeStoreSlug: match.slug, themeStorePresets: match.presets }).catch(() => undefined);
      }
    }
  }
  return { live, notLive, notLiveThemes };
}
