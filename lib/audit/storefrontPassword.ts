import { assertPublicUrl } from "@/lib/net/publicUrl";

// Shopify "password protected" storefronts: every page redirects to /password until a visitor posts the store's password there,
// which answers with a session cookie (storefront_digest). The audit logs in once per store with the password saved for the
// theme and sends that cookie, to that store's host only, on the demo-page reads. Google's PageSpeed Insights can't log in, so
// speed is not measured for such a store (lib/audit/pageSpeed.ts).

export type StorefrontSession = { host: string; cookie: string };

/** A page read returned the store's password page instead of the page asked for. */
export class PasswordProtectedError extends Error {
  constructor(message = "This demo store is password-protected. Save its password for this theme, then run the check again.") {
    super(message);
    this.name = "PasswordProtectedError";
  }
}

/** Shopify's password page: a form posting `form_type=storefront_password` to /password. */
export function isPasswordPage(html: string): boolean {
  return /storefront_password/i.test(html) || /<form[^>]+action=["'][^"']*\/password["']/i.test(html);
}

/** The `<input type="hidden">` fields of the first password form (form_type, utf8, an authenticity token if the store sends one). */
export function parseHiddenInputs(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    if (!/type=["']hidden["']/i.test(tag)) continue;
    const name = /name=["']([^"']+)["']/i.exec(tag)?.[1];
    const value = /value=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    if (name) out[name] = value.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  }
  return out;
}

/** `name=value` pairs from a response's Set-Cookie headers (attributes dropped). */
function cookiePairs(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  return raw.map((c) => c.split(";")[0].trim()).filter((c) => c.includes("="));
}

type Lookup = Parameters<typeof assertPublicUrl>[1];
const TIMEOUT_MS = 20_000;

async function send(url: string, init: RequestInit, resolve?: Lookup): Promise<Response> {
  const checked = await assertPublicUrl(url, resolve);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(checked, { ...init, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

export type LoginResult = { ok: true; session: StorefrontSession | null } | { ok: false; error: string };

/**
 * Logs in to a password-protected store and returns its session cookie. `session: null` means the store has no password page (it is
 * public), so there is nothing to send. The login is checked by reading the home page with the cookie: if it still shows the password
 * page, the password was not accepted.
 */
export async function loginToStorefront(anyUrl: string, password: string, resolve?: Lookup): Promise<LoginResult> {
  try {
    const origin = new URL(anyUrl).origin;
    const host = new URL(anyUrl).hostname;
    const jar = new Map<string, string>();
    const remember = (res: Response) => {
      for (const pair of cookiePairs(res)) jar.set(pair.slice(0, pair.indexOf("=")), pair);
    };
    const cookie = () => [...jar.values()].join("; ");

    const page = await send(`${origin}/password`, { method: "GET" }, resolve);
    remember(page);
    const html = page.status === 200 ? await page.text() : "";
    if (!isPasswordPage(html)) return { ok: true, session: null };

    const body = new URLSearchParams({ form_type: "storefront_password", utf8: "✓", ...parseHiddenInputs(html), password });
    const post = await send(`${origin}/password`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", Cookie: cookie() }, body: body.toString() }, resolve);
    remember(post);

    // Proof: the home page, read with the cookie we now hold, must not be the password page.
    let current = `${origin}/`;
    for (let hop = 0; hop < 4; hop++) {
      const res = await send(current, { method: "GET", headers: { Cookie: cookie() } }, resolve);
      remember(res);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, current);
        if (next.pathname.replace(/\/$/, "") === "/password") return { ok: false, error: "The store did not accept that password." };
        current = next.toString();
        continue;
      }
      if (!res.ok) return { ok: false, error: `The store answered ${res.status} after the login.` };
      if (isPasswordPage(await res.text())) return { ok: false, error: "The store did not accept that password." };
      return { ok: true, session: { host, cookie: cookie() } };
    }
    return { ok: false, error: "The store kept redirecting after the login." };
  } catch (err) {
    return { ok: false, error: `Could not log in to the store: ${err instanceof Error ? err.message : String(err)}` };
  }
}
