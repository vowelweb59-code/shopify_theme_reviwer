// The CSRF cookie and the return redirect for the Google Chat consent flow
// (same approach as lib/analytics/oauthState.ts for GA4).
export const CHAT_STATE_COOKIE = "chat_oauth_state";

export const chatStateCookieOptions = {
  httpOnly: true,
  // "lax" (not "strict") so the cookie survives Google's top-level redirect back.
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/chat/google",
  maxAge: 10 * 60,
};

/** Back to the Projects page, where the import dialog shows the outcome. Prefers APP_URL over the request origin (behind Render's proxy the latter can be internal). */
export function chatReturnUrl(requestUrl: string, params: Record<string, string>): URL {
  const base = process.env.APP_URL?.replace(/\/+$/, "") || new URL(requestUrl).origin;
  const url = new URL("/projects", base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}
