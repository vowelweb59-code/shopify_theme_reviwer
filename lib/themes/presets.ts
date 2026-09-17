export type DemoStorePreset = { label: string; url: string };

const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Normalizes an untrusted preset-list payload (JSON body or form field) into
 * valid {label, url} pairs — used everywhere a theme's preset URLs are set
 * or read back (theme creation, saved defaults, a specific "Run Audit").
 * Entries missing a valid http(s) url are dropped rather than failing the
 * whole request, matching the existing /api/audit/run convention.
 */
export function sanitizePresets(raw: unknown): DemoStorePreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, i) => ({
      label: String((entry as { label?: unknown })?.label ?? "").trim() || `Preset ${i + 1}`,
      url: String((entry as { url?: unknown })?.url ?? "").trim(),
    }))
    .filter((p) => HTTP_URL_RE.test(p.url));
}
