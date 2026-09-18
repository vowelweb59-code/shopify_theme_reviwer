import { Parser } from "htmlparser2";

// Confirmed against real Shopify Theme Store listings (themes.shopify.com):
// a lowercase, hyphen-joined name reliably resolves for a real theme (e.g.
// "Adorn" -> /themes/adorn redirects to /themes/adorn/presets/adorn, 200) —
// a name that doesn't match the listing's slug exactly instead 404s, which
// fetchThemeStoreFeatureLabels surfaces as an error rather than guessing
// further or silently returning nothing.
export function deriveThemeStoreSlug(themeName: string): string {
  return themeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const THEME_STORE_TIMEOUT_MS = 20_000;

export type ThemeStoreFeaturesResult =
  | { ok: true; slug: string; features: string[] }
  | { ok: false; slug: string; error: string };

// Every feature name on a real listing page renders as
// `<span class="tw-mr-sm">Feature Name</span>` inside the page's "Features"
// section (confirmed against a real listing) — this class name is specific
// enough elsewhere on the page not to produce false positives, so this
// doesn't bother scoping to the surrounding #features container.
function extractFeatureLabels(html: string): string[] {
  const labels = new Set<string>();
  let capturing = false;
  let buffer = "";

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === "span" && (attribs.class ?? "").split(/\s+/).includes("tw-mr-sm")) {
          capturing = true;
          buffer = "";
        }
      },
      ontext(text) {
        if (capturing) buffer += text;
      },
      onclosetag(name) {
        if (name === "span" && capturing) {
          capturing = false;
          const label = buffer.trim();
          if (label) labels.add(label);
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return [...labels];
}

/**
 * Fetches a theme's public Shopify Theme Store listing (derived from its
 * name — see deriveThemeStoreSlug) and extracts the feature names it
 * advertises. Never throws: a slug that doesn't resolve, or a page whose
 * layout doesn't match what this was written against, comes back as
 * `{ok: false, error}` so the caller can surface exactly why rather than
 * silently having no data.
 */
export async function fetchThemeStoreFeatureLabels(themeName: string): Promise<ThemeStoreFeaturesResult> {
  const slug = deriveThemeStoreSlug(themeName);
  if (!slug) return { ok: false, slug, error: "Could not derive a Theme Store URL from this theme's name." };

  const url = `https://themes.shopify.com/themes/${slug}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), THEME_STORE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      return {
        ok: false,
        slug,
        error: `No Shopify Theme Store listing found at themes.shopify.com/themes/${slug} (status ${res.status}) — this theme's name may not match its Theme Store listing exactly.`,
      };
    }
    const html = await res.text();
    const features = extractFeatureLabels(html);
    if (features.length === 0) {
      return { ok: false, slug, error: "Reached a Theme Store page, but couldn't find its Features section — the page layout may have changed." };
    }
    return { ok: true, slug, features };
  } catch (err) {
    return { ok: false, slug, error: err instanceof Error ? err.message : "Failed to reach the Shopify Theme Store." };
  } finally {
    clearTimeout(timeout);
  }
}
