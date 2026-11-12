import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { ThemeZip } from "@/models/theme-zip";
import { parseThemeZip } from "@/lib/theme-parser";
import { sanitizePresets, MAX_PRESETS } from "./presets";
import { localUploadSource } from "./themeSource";
import { fetchPresetDemoStoreUrls } from "./themeStoreFeatures";
import { presetNamesFromSettingsData, presetSlug } from "./zipPresets";

type ThemeLike = {
  _id: unknown;
  demoStorePresets?: unknown;
  themeStoreSlug?: string | null;
  themeStorePresets?: { name: string; slug: string }[] | null;
};

/** Preset names in the theme's latest uploaded ZIP (config/settings_data.json); [] when there is no ZIP or none are declared. */
async function zipPresetNames(themeId: unknown): Promise<string[]> {
  const versionIds = (await ThemeVersion.find({ themeId }).select("_id").lean()).map((v) => v._id);
  if (versionIds.length === 0) return [];
  const zip = await ThemeZip.findOne({ themeVersionId: { $in: versionIds } }).sort({ uploadedAt: -1 });
  if (!zip) return [];
  const parsed = await parseThemeZip(await localUploadSource(zip).getZipBuffer());
  const settings = parsed.files.find((f) => f.path.replace(/\\/g, "/").endsWith("config/settings_data.json"));
  return settings ? presetNamesFromSettingsData(settings.rawText) : [];
}

/**
 * The demo-store URLs to audit and measure for a theme: the saved ones, else found automatically and saved so this runs once.
 * Candidates are the presets on the theme's Theme Store listing plus the ones its ZIP declares in config/settings_data.json;
 * each one's demo URL is read from its Theme Store preset page (themes.shopify.com/themes/<theme>/presets/<preset>). An audit
 * with no preset URLs skips the live checks and PageSpeed entirely (Desktop/Mobile Performance stay N/A), so every audit path
 * calls this instead of reading the field directly. Returns [] when nothing is found.
 */
export async function ensureDemoPresets(theme: ThemeLike): Promise<{ label: string; url: string }[]> {
  const saved = sanitizePresets(theme.demoStorePresets);
  if (saved.length > 0 || !theme.themeStoreSlug) return saved;

  const candidates = new Map<string, { slug: string; name: string }>();
  for (const p of theme.themeStorePresets ?? []) candidates.set(p.slug, { slug: p.slug, name: p.name });
  const fromZip = await zipPresetNames(theme._id).catch(() => [] as string[]);
  for (const name of fromZip) {
    const slug = presetSlug(name);
    if (slug && !candidates.has(slug)) candidates.set(slug, { slug, name });
  }
  if (candidates.size === 0) return [];

  const found = await fetchPresetDemoStoreUrls(theme.themeStoreSlug, [...candidates.values()].slice(0, MAX_PRESETS * 2));
  const presets = sanitizePresets(found.filter((p) => p.url).map((p) => ({ label: p.name, url: p.url })));
  if (presets.length > 0) await Theme.updateOne({ _id: theme._id }, { $set: { demoStorePresets: presets } });
  return presets;
}
