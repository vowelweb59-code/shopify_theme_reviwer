// Pulls the Space export (the whole Chat space as threaded text) from the LIVE app. Shared by scripts/fetch-space.ts and scripts/space-daily.ts.
// Preferred: SPACE_EXPORT_TOKEN from the env file, sent as a bearer token to the one export path (lib/auth/exportToken.ts). Fallback: sign in
// with BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. Secrets are never logged. No `server-only` import, so it runs outside Next.

export async function fetchSpaceText(opts: { base?: string; username?: string; password?: string; space?: string; days?: number } = {}): Promise<string> {
  const query = new URLSearchParams({ ...(opts.space ? { space: opts.space } : {}), ...(opts.days ? { days: String(opts.days) } : {}) }).toString();
  const exportUrl = (b: string) => `${b}/api/service/space-scan/export${query ? `?${query}` : ""}`;
  const base = (opts.base ?? process.env.LIVE_URL ?? "https://shopify-theme-reviwer.onrender.com").replace(/\/$/, "");
  const token = process.env.SPACE_EXPORT_TOKEN?.trim();
  if (token) {
    const res = await fetch(exportUrl(base), {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15 * 60_000),
    });
    if (res.status === 401)
      throw new Error(
        "The export token was refused (401): SPACE_EXPORT_TOKEN must be the same string in Render and in the local env file, and Render must have redeployed."
      );
    if (!res.ok) throw new Error(`Export failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.text();
  }
  const username = opts.username ?? process.env.BASIC_AUTH_USER;
  const password = opts.password ?? process.env.BASIC_AUTH_PASSWORD;
  if (!username || !password) throw new Error("BASIC_AUTH_USER / BASIC_AUTH_PASSWORD are not in the env file, and there is no SPACE_EXPORT_TOKEN either.");

  const login = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!login.ok) throw new Error(`Sign-in failed (${login.status}).`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Sign-in gave no session cookie.");

  const res = await fetch(exportUrl(base), { headers: { cookie }, signal: AbortSignal.timeout(15 * 60_000) });
  if (!res.ok) throw new Error(`Export failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.text();
}
