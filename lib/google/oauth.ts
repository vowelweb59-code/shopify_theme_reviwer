import { oauth2 as oauth2Api } from "@googleapis/oauth2";
import { OAuth2Client } from "google-auth-library";
import { GoogleAuth } from "@/models/google-auth";
import { GOOGLE_API_TIMEOUT_MS } from "@/lib/google/timeouts";
import { decryptSecret, encryptSecret } from "@/lib/analytics/crypto";

// Sheets tokens are encrypted at rest with the same AES-256-GCM key as the
// GA4 tokens (ANALYTICS_TOKEN_ENCRYPTION_KEY). Without the key (local dev
// that never set up GA4) they're stored as before. Tokens saved before
// 2026-09-29 are plaintext; they're read as-is and re-saved encrypted.
function sealToken(token: string): string {
  return process.env.ANALYTICS_TOKEN_ENCRYPTION_KEY ? encryptSecret(token) : token;
}

function isSealed(value: string): boolean {
  return value.startsWith("v1.") && value.split(".").length === 4;
}

function openToken(value: string): string {
  return isSealed(value) ? decryptSecret(value) : value;
}

export const SHEETS_OAUTH_STATE_COOKIE = "sheets_oauth_state";
export const sheetsOAuthStateCookieOptions = {
  httpOnly: true,
  // "lax" (not "strict") so the cookie survives Google's top-level redirect back.
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/google",
  maxAge: 10 * 60,
};

// Only what's needed to create/write the app's own spreadsheets and know
// which account is connected. drive.file covers the Sheets API for files
// this app created (all of its export sheets); the broader `spreadsheets`
// scope, which reaches every spreadsheet on the account, was dropped
// 2026-09-29.
const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];
const BROAD_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example for Google Sheets export setup.`);
  return value;
}

export function createOAuthClient() {
  return new OAuth2Client(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function getGoogleAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    state,
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces the consent screen so a refresh_token is issued even on a reconnect
    scope: SHEETS_SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Google did not return a full token set (missing refresh_token — try disconnecting and reconnecting).");
  }
  client.setCredentials(tokens);

  const oauth2 = oauth2Api({ auth: client, version: "v2", timeout: GOOGLE_API_TIMEOUT_MS });
  const { data } = await oauth2.userinfo.get();

  return {
    email: data.email ?? "unknown",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
    scope: tokens.scope ?? SHEETS_SCOPES.join(" "),
  };
}

/**
 * Loads the stored singleton token and returns an OAuth2Client ready to
 * call Sheets/Drive APIs, refreshing the access token automatically (and
 * persisting the refreshed one back to Mongo) when it's expired. Returns
 * null if Google Sheets was never connected.
 */
export async function getAuthorizedClient() {
  const stored = await GoogleAuth.findOne().select("+accessToken +refreshToken");
  if (!stored) return null;

  const accessToken = openToken(stored.accessToken);
  const refreshToken = openToken(stored.refreshToken);
  if (process.env.ANALYTICS_TOKEN_ENCRYPTION_KEY && (!isSealed(stored.accessToken) || !isSealed(stored.refreshToken))) {
    await GoogleAuth.updateOne({}, { $set: { accessToken: sealToken(accessToken), refreshToken: sealToken(refreshToken) } });
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: stored.expiryDate,
  });

  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void GoogleAuth.updateOne(
      {},
      {
        $set: {
          accessToken: sealToken(tokens.access_token),
          expiryDate: tokens.expiry_date ?? stored.expiryDate,
          ...(tokens.refresh_token ? { refreshToken: sealToken(tokens.refresh_token) } : {}),
        },
      }
    );
  });

  return client;
}

export async function getGoogleConnectionStatus(): Promise<{ connected: boolean; email?: string; broadScope?: boolean }> {
  const stored = await GoogleAuth.findOne().select("googleEmail scope").lean<{ googleEmail: string; scope?: string }>();
  if (!stored) return { connected: false };
  // Connected before the scope was narrowed: still works, but holds access
  // to every spreadsheet on the account until it's reconnected once.
  const broadScope = (stored.scope ?? "").split(/\s+/).includes(BROAD_SHEETS_SCOPE);
  return { connected: true, email: stored.googleEmail, broadScope };
}

/** Replaces whatever account was connected with this one (only one Google account at a time). */
export async function saveGoogleConnection(t: Awaited<ReturnType<typeof exchangeCodeForTokens>>): Promise<void> {
  await GoogleAuth.deleteMany({});
  await GoogleAuth.create({
    googleEmail: t.email,
    accessToken: sealToken(t.accessToken),
    refreshToken: sealToken(t.refreshToken),
    expiryDate: t.expiryDate,
    scope: t.scope,
  });
}

export async function disconnectGoogle(): Promise<void> {
  await GoogleAuth.deleteMany({});
}
