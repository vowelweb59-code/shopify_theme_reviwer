// Kept apart from session.ts (node:crypto) so the login form can import it.

/**
 * Where to send someone after they sign in. Only a same-site path is
 * allowed ("/themes?x=1"); "//evil.com", "/\evil.com" and absolute URLs
 * fall back to the home page, so the login page can't be used as an open
 * redirect.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  // Browsers treat "\" like "/" and drop tabs/newlines, so "/\evil.com" or
  // "/<tab>/evil.com" would still leave the site.
  if (/[\\\u0000-\u001f]/.test(next)) return "/";
  if (next.startsWith("/login") || next.startsWith("/api/")) return "/";
  return next;
}
