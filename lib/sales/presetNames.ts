/** A theme's presets, base theme first (its default preset shares the theme's name, e.g. "Adorn"). */
export function presetNamesFor(theme: { name: string; themeStorePresets?: { name: string }[] | null }): string[] {
  const names = [theme.name, ...(theme.themeStorePresets ?? []).map((p) => p.name)];
  return [...new Map(names.filter(Boolean).map((n) => [n.toLowerCase(), n])).values()];
}
