import { BlockedUrlError, HttpStatusError, fetchPublicPage } from "@/lib/net/publicUrl";

// Works out which preset a store that bought a theme is using, from its
// public storefront. Every Shopify storefront inlines
// `Shopify.theme = {"name":…,"schema_name":…}` — on password pages too.
// Checked live on the user's Adorn buyers (2026-09-29): an installed
// preset keeps the preset's name ("Precious", "Ace", "Closet", "Choice",
// "Ace - Dev Copy"), `schema_name` is always the base theme ("Adorn"), and
// `theme_store_id` is the same for every preset, so the name is the only
// preset signal. A store that closed answers 402; one that switched theme
// shows another schema_name (e.g. "Horizon").

export type StoreStatus = "live" | "password" | "unavailable" | "dropped" | "error";

export type StoreCheck = {
  status: StoreStatus;
  liveUrl: string | null;
  liveThemeName: string | null;
  liveSchemaName: string | null;
  /** Preset matched from the live theme name, when the store still runs this theme. */
  presetFromName: string | null;
  error: string | null;
};

const FETCH_TIMEOUT_MS = 20_000;

/** Values the sheet's Preset column uses for "we couldn't tell" rather than a preset name. */
const NON_PRESET_VALUES = new Set(["store unavailable", "password protection", "dropped", "unknown", ""]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The preset whose name appears as a whole word in `text` (case-insensitive).
 * `presetNames[0]` must be the base theme's own name (its default preset).
 */
export function matchPresetName(text: string | null | undefined, presetNames: string[]): string | null {
  if (!text) return null;
  const matches = presetNames.filter((name) => name && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`, "iu").test(text));
  if (matches.length <= 1) return matches[0] ?? null;
  // Both the base theme and a preset appear ("Adorn - Ace"): the preset is
  // the more specific answer. Otherwise the longest name wins.
  const nonBase = matches.filter((m) => m.toLowerCase() !== presetNames[0]?.toLowerCase());
  return (nonBase.length > 0 ? nonBase : matches).sort((a, b) => b.length - a.length)[0];
}

/** A sheet Preset value that names a real preset ("Precious"), or null for "Store Unavailable" etc. */
export function sheetPresetName(value: string | null | undefined, presetNames: string[]): string | null {
  if (!value || NON_PRESET_VALUES.has(value.trim().toLowerCase())) return null;
  return presetNames.find((n) => n.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

export function classifyStorefront(
  html: string,
  finalUrl: string,
  themeName: string,
  presetNames: string[]
): StoreCheck {
  const match = /Shopify\.theme\s*=\s*(\{[^;]*\});/.exec(html);
  let parsed: { name?: string; schema_name?: string } = {};
  if (match) {
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      // fall through with no theme info
    }
  }
  const liveThemeName = parsed.name ?? null;
  const liveSchemaName = parsed.schema_name ?? null;
  const isPassword = /\/password(\/|$|\?)/.test(new URL(finalUrl).pathname) || /<form[^>]+action=["']\/password["']/i.test(html);

  if (!match) {
    return { status: "error", liveUrl: finalUrl, liveThemeName: null, liveSchemaName: null, presetFromName: null, error: "No Shopify theme data on the page (not a Shopify store any more?)." };
  }
  const sameTheme = (liveSchemaName ?? "").trim().toLowerCase() === themeName.trim().toLowerCase();
  if (!sameTheme) {
    return { status: "dropped", liveUrl: finalUrl, liveThemeName, liveSchemaName, presetFromName: null, error: null };
  }
  return {
    status: isPassword ? "password" : "live",
    liveUrl: finalUrl,
    liveThemeName,
    liveSchemaName,
    presetFromName: matchPresetName(liveThemeName, presetNames),
    error: null,
  };
}

export async function checkStore(shopDomain: string, themeName: string, presetNames: string[]): Promise<StoreCheck> {
  try {
    const { url, text } = await fetchPublicPage(`https://${shopDomain}/`, { timeoutMs: FETCH_TIMEOUT_MS });
    return classifyStorefront(text, url, themeName, presetNames);
  } catch (err) {
    // 402 = Shopify's "store unavailable" (closed / unpaid); 404 = gone.
    if (err instanceof HttpStatusError && (err.status === 402 || err.status === 404 || err.status === 410)) {
      return { status: "unavailable", liveUrl: null, liveThemeName: null, liveSchemaName: null, presetFromName: null, error: null };
    }
    if (err instanceof BlockedUrlError && /resolve/i.test(err.message)) {
      return { status: "unavailable", liveUrl: null, liveThemeName: null, liveSchemaName: null, presetFromName: null, error: null };
    }
    return {
      status: "error",
      liveUrl: null,
      liveThemeName: null,
      liveSchemaName: null,
      presetFromName: null,
      error: err instanceof Error ? err.message : "Couldn't reach the store.",
    };
  }
}
