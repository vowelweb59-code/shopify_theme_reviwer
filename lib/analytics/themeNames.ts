import "server-only";
import { Theme } from "@/models/theme";

/** The names an install event may use for an analytics theme: its own, the audited theme's, and that theme's Theme Store presets. */
export async function themeNames(theme: { name: string; themeId?: { toString(): string } | null }): Promise<string[]> {
  const names = [theme.name];
  if (theme.themeId) {
    const audited = await Theme.findById(theme.themeId).select("name themeStorePresets").lean<{ name: string; themeStorePresets?: { name: string }[] } | null>();
    if (audited) names.push(audited.name, ...(audited.themeStorePresets ?? []).map((p) => p.name));
  }
  return names;
}
