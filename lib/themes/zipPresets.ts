/** Style-variant ("preset") names a theme ships in config/settings_data.json: the keys of its top-level `presets` object. */
export function presetNamesFromSettingsData(rawText: string): string[] {
  // Shopify's settings_data.json usually starts with a /* ... */ comment block, which JSON.parse rejects.
  const text = rawText.replace(/^﻿/, "").replace(/^\s*\/\*[\s\S]*?\*\//, "").trim();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const presets = (data as { presets?: unknown } | null)?.presets;
  if (!presets || typeof presets !== "object" || Array.isArray(presets)) return [];
  return Object.keys(presets as Record<string, unknown>).filter((n) => n.trim());
}

/** A preset's Theme Store slug is its name lower-cased with runs of other characters turned into "-". */
export function presetSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
