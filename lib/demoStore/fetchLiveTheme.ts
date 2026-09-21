const DEMO_STORE_URL = "https://theme-store-ops-admin.myshopify.com/";
const FETCH_TIMEOUT_MS = 20_000;

export type LiveThemeResult =
  | { ok: true; themeId: number; themeName: string; schemaName: string | null; schemaVersion: string | null }
  | { ok: false; error: string };

/**
 * Fetches the ops demo store's public storefront and reads which theme is
 * currently live. Every Shopify storefront inlines its published theme as
 * `Shopify.theme = {...};` in a <head> script — the only theme information
 * a page load can see anonymously, since the store's full theme library
 * (drafts/unpublished themes) requires Admin API credentials this app
 * deliberately doesn't have (see conversation: public-storefront-only by
 * choice). Never throws — a network failure or an unrecognized page layout
 * comes back as {ok: false, error} so the caller can record why.
 */
export async function fetchLiveDemoStoreTheme(): Promise<LiveThemeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DEMO_STORE_URL, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      return { ok: false, error: `Demo store responded with status ${res.status}.` };
    }
    const html = await res.text();
    const match = /Shopify\.theme\s*=\s*(\{[^;]*\});/.exec(html);
    if (!match) {
      return { ok: false, error: "Couldn't find the live theme marker on the storefront page — its layout may have changed." };
    }

    let parsed: { id?: number; name?: string; schema_name?: string; schema_version?: string };
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      return { ok: false, error: "Found the live theme marker but couldn't parse it as JSON." };
    }
    if (typeof parsed.id !== "number") {
      return { ok: false, error: "Live theme marker had no numeric id." };
    }

    return {
      ok: true,
      themeId: parsed.id,
      themeName: parsed.name ?? `Theme ${parsed.id}`,
      schemaName: parsed.schema_name ?? null,
      schemaVersion: parsed.schema_version ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to reach the demo store." };
  } finally {
    clearTimeout(timeout);
  }
}
