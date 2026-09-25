import { randomBytes, timingSafeEqual } from "node:crypto";

// CSRF protection for the GA4 OAuth round trip: the connect route sets a
// random `state` in an httpOnly cookie and sends the same value to Google;
// the callback only accepts a code whose `state` matches the cookie. Without
// this, anyone could get a victim's browser to attach the attacker's Google
// account to this app.
export const OAUTH_STATE_COOKIE = "ga4_oauth_state";

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function isValidOAuthState(fromQuery: string | null, fromCookie: string | undefined): boolean {
  if (!fromQuery || !fromCookie) return false;
  const a = Buffer.from(fromQuery);
  const b = Buffer.from(fromCookie);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const oauthStateCookieOptions = {
  httpOnly: true,
  // "lax" (not "strict") so the cookie survives Google's top-level redirect back.
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/analytics/google",
  maxAge: 10 * 60,
};

/**
 * Where to send the browser after the OAuth round trip: the Settings page's
 * GA4 tab. Prefers APP_URL over the request's origin, because behind
 * Render's proxy the request URL can carry the container's internal host.
 */
export function ga4SettingsUrl(requestUrl: string, params: Record<string, string>): URL {
  const base = process.env.APP_URL?.replace(/\/+$/, "") || new URL(requestUrl).origin;
  const url = new URL("/settings", base);
  url.searchParams.set("tab", "analytics");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}
