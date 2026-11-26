// Reads from the LIVE app for the daily Live Project Chat Summary job and the scripts (fetch-space.ts, match-spaces.ts). Preferred sign-in:
// SPACE_EXPORT_TOKEN from the env file, sent as a bearer token to the few read-only paths it opens (lib/auth/exportToken.ts). Fallback:
// BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. Secrets are never logged. No `server-only` import, so it runs outside Next.

const liveBase = (b?: string) => (b ?? process.env.LIVE_URL ?? "https://shopify-theme-reviwer.onrender.com").replace(/\/$/, "");

/** The headers that sign a request in: the token, else a session cookie obtained with the team login. */
async function authHeaders(base: string, opts: { username?: string; password?: string }): Promise<Record<string, string>> {
  const token = process.env.SPACE_EXPORT_TOKEN?.trim();
  if (token) return { authorization: `Bearer ${token}` };
  const username = opts.username ?? process.env.BASIC_AUTH_USER;
  const password = opts.password ?? process.env.BASIC_AUTH_PASSWORD;
  if (!username || !password) throw new Error("SPACE_EXPORT_TOKEN is not in the env file, and neither are BASIC_AUTH_USER / BASIC_AUTH_PASSWORD.");
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
  return { cookie };
}

async function liveGet(path: string, opts: { base?: string; username?: string; password?: string } = {}): Promise<Response> {
  const base = liveBase(opts.base);
  const res = await fetch(`${base}${path}`, { headers: await authHeaders(base, opts), signal: AbortSignal.timeout(15 * 60_000) });
  if (res.status === 401 && process.env.SPACE_EXPORT_TOKEN?.trim()) {
    throw new Error(
      "The export token was refused (401): SPACE_EXPORT_TOKEN must be the same string in Render and in the local env file, and Render must have redeployed."
    );
  }
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** A Chat space as threaded text (optionally only the last `days` days). */
export async function fetchSpaceText(opts: { base?: string; username?: string; password?: string; space?: string; days?: number } = {}): Promise<string> {
  const query = new URLSearchParams({ ...(opts.space ? { space: opts.space } : {}), ...(opts.days ? { days: String(opts.days) } : {}) }).toString();
  return (await liveGet(`/api/service/space-scan/export${query ? `?${query}` : ""}`, opts)).text();
}

/** A read-only JSON endpoint of the live app (`/api/service/space-scan/targets`, `.../spaces`). */
export async function fetchLiveJson<T>(path: string): Promise<T> {
  return (await liveGet(path)).json() as Promise<T>;
}
