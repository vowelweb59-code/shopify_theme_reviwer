// The one way the crawlers of public pages (Theme Store, App Store, Partner Directory) fetch a page: a browser-like User-Agent, a
// timeout, and a wait-and-retry when the site answers 429. Fixed hosts only; user-supplied URLs go through lib/net/publicUrl.ts.

export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type FetchPublicOptions = {
  /** Total tries; only a 429 is retried, after `rateLimitWaitMs`. Default 3. */
  attempts?: number;
  rateLimitWaitMs?: number;
  /** "manual" stops at a redirect (use with `nullOnRedirect`). Default "follow". */
  redirect?: "follow" | "manual";
  /** A 404 gives null instead of throwing. */
  nullOn404?: boolean;
  /** A 3xx gives null instead of throwing (needs redirect "manual"): e.g. a country that doesn't exist. */
  nullOnRedirect?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

type Nullable = { nullOn404: true } | { nullOnRedirect: true };

export async function fetchPublicText(url: string, opts: FetchPublicOptions & Nullable): Promise<string | null>;
export async function fetchPublicText(url: string, opts?: FetchPublicOptions): Promise<string>;
export async function fetchPublicText(url: string, opts: FetchPublicOptions = {}): Promise<string | null> {
  const { attempts = 3, rateLimitWaitMs = 90_000, redirect = "follow", nullOn404 = false, nullOnRedirect = false, headers = {}, timeoutMs = 30_000 } = opts;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, ...headers }, redirect, signal: AbortSignal.timeout(timeoutMs) });
    if (nullOnRedirect && res.status >= 300 && res.status < 400) return null;
    if (nullOn404 && res.status === 404) return null;
    if (res.status === 429 && attempt < attempts - 1) {
      await sleep(rateLimitWaitMs);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  }
  throw new Error(`Rate limited (429) for ${url}`);
}
