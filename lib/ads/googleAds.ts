import "server-only";
import { OAuth2Client } from "google-auth-library";
import { decryptSecret, encryptSecret } from "@/lib/analytics/crypto";
import { AdsConnection } from "@/models/ads-connection";

// Google Ads through its REST API, as the Google account that connected. Same
// OAuth client as GA4/Sheets/Chat (GOOGLE_CLIENT_ID/SECRET) with its own consent
// flow and callback. Needs a Google Ads developer token (GOOGLE_ADS_DEVELOPER_TOKEN).

export const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const ADS_OAUTH_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", ADS_SCOPE];
export const ADS_OAUTH_CALLBACK_PATH = "/api/ads/google/callback";
export const ADS_STATE_COOKIE = "ads_oauth_state";
export const adsStateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/ads/google",
  maxAge: 10 * 60,
};

export class AdsOAuthError extends Error {
  constructor(
    public readonly code: "not_configured" | "missing_scope" | "invalid_identity" | "token_exchange_failed",
    message: string
  ) {
    super(message);
    this.name = "AdsOAuthError";
  }
}

type Env = Record<string, string | undefined>;

export function isAdsConfigured(env: Env = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ANALYTICS_TOKEN_ENCRYPTION_KEY && (env.ADS_OAUTH_REDIRECT_URI || env.APP_URL));
}
export const hasDeveloperToken = (env: Env = process.env) => Boolean(env.GOOGLE_ADS_DEVELOPER_TOKEN);

export function getAdsRedirectUri(env: Env = process.env): string {
  if (env.ADS_OAUTH_REDIRECT_URI) return env.ADS_OAUTH_REDIRECT_URI;
  if (env.APP_URL) return `${env.APP_URL.replace(/\/+$/, "")}${ADS_OAUTH_CALLBACK_PATH}`;
  throw new AdsOAuthError("not_configured", "Set APP_URL (or ADS_OAUTH_REDIRECT_URI) to connect Google Ads.");
}

export function createAdsOAuthClient(env: Env = process.env): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new AdsOAuthError("not_configured", "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getAdsRedirectUri(env));
}

export function buildAdsAuthUrl(state: string, client: OAuth2Client = createAdsOAuthClient()): string {
  return client.generateAuthUrl({ access_type: "offline", prompt: "select_account consent", scope: ADS_OAUTH_SCOPES, state });
}

export async function exchangeAdsCode(code: string, client: OAuth2Client = createAdsOAuthClient()) {
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch {
    throw new AdsOAuthError("token_exchange_failed", "Google rejected the sign-in. Try connecting again.");
  }
  if (!tokens.access_token || !tokens.expiry_date) throw new AdsOAuthError("token_exchange_failed", "Google returned an incomplete token set. Try connecting again.");
  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(ADS_SCOPE)) throw new AdsOAuthError("missing_scope", "Access to Google Ads wasn't granted. Reconnect and leave every checkbox ticked.");
  if (!tokens.id_token) throw new AdsOAuthError("invalid_identity", "Google didn't identify the account. Try connecting again.");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: client._clientId }).catch(() => null);
  const payload = ticket?.getPayload();
  if (!payload?.sub || !payload.email) throw new AdsOAuthError("invalid_identity", "Couldn't verify which Google account signed in. Try connecting again.");
  return { googleAccountId: payload.sub, email: payload.email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null, expiryDate: new Date(tokens.expiry_date), scopes };
}

type ConnectionDoc = NonNullable<Awaited<ReturnType<typeof loadAdsConnection>>>;
export async function loadAdsConnection() {
  return AdsConnection.findOne({ key: "ads" }).select("+encryptedAccessToken +encryptedRefreshToken");
}

/** A valid access token, refreshed (and saved) when about to expire. */
export async function adsAccessToken(connection: ConnectionDoc): Promise<string> {
  let accessToken = connection.encryptedAccessToken ? decryptSecret(connection.encryptedAccessToken) : "";
  const refreshToken = connection.encryptedRefreshToken ? decryptSecret(connection.encryptedRefreshToken) : null;
  if (!accessToken || !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() - Date.now() < 60_000) {
    if (!refreshToken) throw Object.assign(new Error("No refresh token."), { response: { data: { error: "invalid_grant" } } });
    const client = createAdsOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token || !credentials.expiry_date) throw new Error("Google returned an incomplete token set.");
    accessToken = credentials.access_token;
    connection.encryptedAccessToken = encryptSecret(accessToken);
    connection.tokenExpiresAt = new Date(credentials.expiry_date);
    await connection.save();
  }
  return accessToken;
}

// --- reading accounts --------------------------------------------------------

export type AdsAccount = { id: string; name: string | null; manager: boolean; currency: string | null; error?: string };

const API = () => `https://googleads.googleapis.com/${process.env.GOOGLE_ADS_API_VERSION ?? "v22"}`;

function headers(accessToken: string, loginCustomerId?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "Content-Type": "application/json",
    ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
  };
}

async function apiError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `Google Ads returned ${res.status}.`;
}

/** The Google Ads accounts the connected Google user can open, with each one's name where Google lets us read it. */
export async function listAdsAccounts(accessToken: string, fetcher: typeof fetch = fetch): Promise<AdsAccount[]> {
  const list = await fetcher(`${API()}/customers:listAccessibleCustomers`, { headers: headers(accessToken) });
  if (!list.ok) throw new Error(await apiError(list));
  const ids = (((await list.json()) as { resourceNames?: string[] }).resourceNames ?? []).map((r) => r.replace("customers/", ""));
  return Promise.all(
    ids.map(async (id): Promise<AdsAccount> => {
      const res = await fetcher(`${API()}/customers/${id}/googleAds:search`, {
        method: "POST",
        headers: headers(accessToken, id),
        body: JSON.stringify({ query: "SELECT customer.descriptive_name, customer.manager, customer.currency_code FROM customer LIMIT 1" }),
      });
      if (!res.ok) return { id, name: null, manager: false, currency: null, error: await apiError(res) };
      const c = ((await res.json()) as { results?: { customer?: { descriptiveName?: string; manager?: boolean; currencyCode?: string } }[] }).results?.[0]?.customer;
      return { id, name: c?.descriptiveName ?? null, manager: Boolean(c?.manager), currency: c?.currencyCode ?? null };
    })
  );
}
