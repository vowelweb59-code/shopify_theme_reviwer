export type DemoStorePreset = { label: string; url: string };

const HTTP_URL_RE = /^https?:\/\//i;

// A single cap shared by the UI (PresetLinksEditor stops offering "+ Add")
// and this sanitizer (a direct API call can't bypass the UI's limit).
export const MAX_PRESETS = 5;

/**
 * Normalizes an untrusted preset-list payload (JSON body or form field) into
 * valid {label, url} pairs — used everywhere a theme's preset URLs are set
 * or read back (theme creation, saved defaults, a specific "Run Audit").
 * Entries missing a valid http(s) url are dropped rather than failing the
 * whole request, matching the existing /api/audit/run convention. Capped at
 * MAX_PRESETS entries — extra ones are silently dropped, not rejected.
 */
export function sanitizePresets(raw: unknown): DemoStorePreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, i) => ({
      label: String((entry as { label?: unknown })?.label ?? "").trim() || `Preset ${i + 1}`,
      url: String((entry as { url?: unknown })?.url ?? "").trim(),
    }))
    .filter((p) => HTTP_URL_RE.test(p.url))
    .slice(0, MAX_PRESETS);
}
