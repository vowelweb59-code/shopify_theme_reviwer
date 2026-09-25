import "server-only";
import { google, type Auth } from "googleapis";

// GA4 analytics OAuth: its own consent flow, separate from the Sheets
// export's (lib/google/oauth.ts) but on the same Google Cloud OAuth client
// (GOOGLE_CLIENT_ID/SECRET). Server-side only — nothing here may be
// imported by a client component.

export const ANALYTICS_READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

// Read-only analytics plus just enough identity to tell accounts apart.
// No write access to GA4, no Drive/Sheets.
export const GA4_OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  ANALYTICS_READONLY_SCOPE,
];

export const GA4_OAUTH_CALLBACK_PATH = "/api/analytics/google/callback";

/** Failures the UI shows by code. `message` is safe to display: never a token or a raw Google response body. */
export class Ga4OAuthError extends Error {
  constructor(
    public readonly code: "not_configured" | "missing_scope" | "missing_refresh_token" | "invalid_identity" | "token_exchange_failed",
    message: string
  ) {
    super(message);
    this.name = "Ga4OAuthError";
  }
}

type Env = Record<string, string | undefined>;

export function isGa4OAuthConfigured(env: Env = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ANALYTICS_TOKEN_ENCRYPTION_KEY && (env.GA4_OAUTH_REDIRECT_URI || env.APP_URL));
}

export function getGa4RedirectUri(env: Env = process.env): string {
  if (env.GA4_OAUTH_REDIRECT_URI) return env.GA4_OAUTH_REDIRECT_URI;
  if (env.APP_URL) return `${env.APP_URL.replace(/\/+$/, "")}${GA4_OAUTH_CALLBACK_PATH}`;
  throw new Ga4OAuthError("not_configured", "Set APP_URL (or GA4_OAUTH_REDIRECT_URI) — see .env.example for GA4 analytics setup.");
}

export function createGa4OAuthClient(env: Env = process.env): Auth.OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Ga4OAuthError("not_configured", "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — see .env.example.");
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getGa4RedirectUri(env));
}

export function buildGa4AuthUrl({ state, loginHint }: { state: string; loginHint?: string }, client: Auth.OAuth2Client = createGa4OAuthClient()): string {
  return client.generateAuthUrl({
    access_type: "offline", // needed for a refresh_token
    // select_account: always show the account chooser, or Google silently
    // reuses whichever account the browser is signed into, which makes
    // connecting a *second* account impossible. consent: re-issue a
    // refresh_token even for an account that's connected before.
    prompt: "select_account consent",
    scope: GA4_OAUTH_SCOPES,
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
}

export type Ga4OAuthResult = {
  googleAccountId: string;
  email: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string | null; // null only if Google skipped it; the caller may still have one stored
  expiryDate: Date;
  scopes: string[];
};

export async function exchangeGa4Code(code: string, client: Auth.OAuth2Client = createGa4OAuthClient()): Promise<Ga4OAuthResult> {
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch (err) {
    throw new Ga4OAuthError("token_exchange_failed", `Google rejected the sign-in (${googleErrorCode(err) ?? "unknown error"}). Try connecting again.`);
  }

  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Ga4OAuthError("token_exchange_failed", "Google returned an incomplete token set. Try connecting again.");
  }

  // Google's consent screen lets the user untick individual scopes, so a
  // successful sign-in doesn't guarantee analytics access was granted.
  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(ANALYTICS_READONLY_SCOPE)) {
    throw new Ga4OAuthError("missing_scope", "Google Analytics access wasn't granted — reconnect and leave the Analytics checkbox ticked.");
  }

  if (!tokens.id_token) throw new Ga4OAuthError("invalid_identity", "Google didn't identify the account. Try connecting again.");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: client._clientId }).catch(() => null);
  const payload = ticket?.getPayload();
  if (!payload?.sub || !payload.email) throw new Ga4OAuthError("invalid_identity", "Couldn't verify which Google account signed in. Try connecting again.");

  return {
    googleAccountId: payload.sub,
    email: payload.email,
    displayName: payload.name ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: new Date(tokens.expiry_date),
    scopes,
  };
}

/** The OAuth `error` code from a Google token-endpoint failure (e.g. "invalid_grant"), if there is one. */
export function googleErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") return (data as { error: string }).error;
  return null;
}

/**
 * Maps a token-refresh failure to what it means for the connection:
 * "revoked" — the refresh token is dead, only a reconnect helps.
 * "config" — this app's OAuth client is misconfigured (wrong secret, ...).
 * "transient" — network or Google-side trouble; retrying may just work.
 */
export function classifyRefreshError(err: unknown): "revoked" | "config" | "transient" {
  const code = googleErrorCode(err);
  if (code === "invalid_grant") return "revoked";
  if (code === "invalid_client" || code === "unauthorized_client") return "config";
  return "transient";
}
