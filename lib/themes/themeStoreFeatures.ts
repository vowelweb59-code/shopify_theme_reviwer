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

export type ThemeStorePreset = { name: string; slug: string };

export type ThemeStoreFeaturesResult =
  | { ok: true; slug: string; features: string[]; presets: ThemeStorePreset[]; latestVersion: string | null; latestVersionReleasedAt: string | null }
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

// A listing's style-variant picker links each preset card as
// `<a href="https://themes.shopify.com/themes/<slug>/presets/<presetSlug>" aria-label="View <Name>">`
// (confirmed against a real listing, e.g. Adorn's "Ace"/"Choice"/"Closet"/
// "Precious" variants) — every other same-shaped href on the page (reviews,
// version-details modal, locale switcher) lacks a "View ..." aria-label, so
// requiring both the URL shape and that label avoids false matches. A card
// can render the same href twice (image + caption), so only the first
// occurrence per slug counts.
function extractPresets(html: string): ThemeStorePreset[] {
  const presets: ThemeStorePreset[] = [];
  const seen = new Set<string>();
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name !== "a") return;
        const href = attribs.href;
        const ariaLabel = attribs["aria-label"];
        if (!href || !ariaLabel) return;
        const hrefMatch = /^https:\/\/themes\.shopify\.com\/themes\/[a-z0-9-]+\/presets\/([a-z0-9-]+)$/.exec(href);
        const labelMatch = /^View (.+)$/.exec(ariaLabel);
        if (!hrefMatch || !labelMatch) return;
        const slug = hrefMatch[1];
        if (seen.has(slug)) return;
        seen.add(slug);
        presets.push({ slug, name: labelMatch[1].trim() });
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return presets;
}

type LatestRelease = { version: string; releasedAt: string | null };

// The listing's "Release Notes" section inlines only its current live
// version's changelog entry as `<h3>Version X.Y.Z</h3>` followed by a
// bullet-separator `<span>` and a second `<span>` holding the
// human-readable release date (e.g. "August 18, 2026") — confirmed against
// a real listing. Full version history lives behind a separate "View
// details" modal (a different URL) this app has no reason to fetch — the
// current version is exactly what "is this theme's uploaded copy behind
// the live listing" needs.
function extractLatestRelease(html: string): LatestRelease | null {
  let result: LatestRelease | null = null;
  let mode: "idle" | "in-h3" | "awaiting-date" | "in-date-span" | "done" = "idle";
  let buffer = "";

  const parser = new Parser(
    {
      onopentag(name) {
        if (mode === "idle" && name === "h3") {
          mode = "in-h3";
          buffer = "";
        } else if (mode === "awaiting-date" && name === "span") {
          mode = "in-date-span";
          buffer = "";
        }
      },
      ontext(text) {
        if (mode === "in-h3" || mode === "in-date-span") buffer += text;
      },
      onclosetag(name) {
        if (mode === "in-h3" && name === "h3") {
          const match = /^Version\s+(.+)$/i.exec(buffer.trim());
          if (match) {
            result = { version: match[1].trim(), releasedAt: null };
            mode = "awaiting-date";
          } else {
            mode = "idle";
          }
        } else if (mode === "in-date-span" && name === "span") {
          const text = buffer.trim();
          if (text && text !== "•") {
            if (result) result.releasedAt = text;
            mode = "done";
          } else {
            mode = "awaiting-date";
          }
        }
      },
    },
    { decodeEntities: true }
  );
  parser.write(html);
  parser.end();
  return result;
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
    const latestRelease = extractLatestRelease(html);
    const presets = extractPresets(html);
    return {
      ok: true,
      slug,
      features,
      presets,
      latestVersion: latestRelease?.version ?? null,
      latestVersionReleasedAt: latestRelease?.releasedAt ?? null,
    };
  } catch (err) {
    return { ok: false, slug, error: err instanceof Error ? err.message : "Failed to reach the Shopify Theme Store." };
  } finally {
    clearTimeout(timeout);
  }
}
