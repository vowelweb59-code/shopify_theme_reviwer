import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Cookie-session login (replaced the HTTP Basic Auth popup 2026-09-29).
// The credentials are still the BASIC_AUTH_USER / BASIC_AUTH_PASSWORD env
// vars already set on Render, so switching needed no new configuration.
//
// A session is a signed, self-contained token — "v1.<expiresAtMs>.<sig>" —
// so the proxy can check it without a database call. It's signed with
// SESSION_SECRET when set, otherwise with a key derived from the
// credentials: changing the password then signs everyone out, which is
// the behaviour you want from a password change anyway.

export const SESSION_COOKIE = "sta_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Env = Record<string, string | undefined>;

/**
 * What the login gate does for these settings. Fails closed in production
 * (the user's decision, 2026-09-29): missing credentials there mean a
 * broken deploy, not an open site. Local dev (NODE_ENV=development/test)
 * stays open without credentials; BASIC_AUTH_DISABLED=1 opens a
 * production build on purpose (e.g. running `next start` locally).
 */
export function authMode(env: Env): "check" | "open" | "misconfigured" {
  if (env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD) return "check";
  if (env.NODE_ENV !== "production" || env.BASIC_AUTH_DISABLED === "1") return "open";
  return "misconfigured";
}

function signingKey(env: Env): Buffer {
  if (env.SESSION_SECRET) return Buffer.from(env.SESSION_SECRET, "utf8");
  return createHash("sha256").update(`session:${env.BASIC_AUTH_USER}:${env.BASIC_AUTH_PASSWORD}`).digest();
}

function sign(payload: string, env: Env): string {
  return createHmac("sha256", signingKey(env)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSessionToken(env: Env, now = Date.now()): string {
  const payload = `v1.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload, env)}`;
}

export function isValidSessionToken(token: string | undefined, env: Env, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return safeEqual(parts[2], sign(`${parts[0]}.${parts[1]}`, env));
}

/**
 * Constant-time credential check. Both sides are hashed first so the
 * comparison takes the same time whatever the supplied lengths are.
 */
export function credentialsMatch(username: string, password: string, env: Env): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const userOk = timingSafeEqual(digest(username), digest(env.BASIC_AUTH_USER ?? ""));
  const passOk = timingSafeEqual(digest(password), digest(env.BASIC_AUTH_PASSWORD ?? ""));
  return userOk && passOk;
}

export function sessionCookieOptions(env: Env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
