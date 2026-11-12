import { Theme } from "@/models/theme";
import { sanitizePresets } from "./presets";
import { fetchPresetDemoStoreUrls } from "./themeStoreFeatures";

type ThemeLike = {
  _id: unknown;
  demoStorePresets?: unknown;
  themeStoreSlug?: string | null;
  themeStorePresets?: { name: string; slug: string }[] | null;
};

/**
 * The demo-store URLs to audit and measure for a theme: the saved ones, else the demo URL the Theme Store listing shows for
 * each preset (saved onto the theme so this runs once). An audit with no preset URLs skips the live checks and PageSpeed
 * entirely, which left Desktop/Mobile Performance at N/A, so every audit path calls this instead of reading the field directly.
 * Returns [] when the theme has no URLs and its listing yields none.
 */
export async function ensureDemoPresets(theme: ThemeLike): Promise<{ label: string; url: string }[]> {
  const saved = sanitizePresets(theme.demoStorePresets);
  if (saved.length > 0 || !theme.themeStoreSlug || !theme.themeStorePresets?.length) return saved;
  const found = await fetchPresetDemoStoreUrls(theme.themeStoreSlug, theme.themeStorePresets);
  const presets = sanitizePresets(found.filter((p) => p.url).map((p) => ({ label: p.name, url: p.url })));
  if (presets.length > 0) await Theme.updateOne({ _id: theme._id }, { $set: { demoStorePresets: presets } });
  return presets;
}
