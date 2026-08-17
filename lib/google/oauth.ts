import { google } from "googleapis";
import { GoogleAuth } from "@/models/google-auth";

// Only what's needed to create/write a spreadsheet and know which account
// is connected — never full Drive access.
const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example for Google Sheets export setup.`);
  return value;
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function getGoogleAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
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

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
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
  const stored = await GoogleAuth.findOne();
  if (!stored) return null;

  const client = createOAuthClient();
  client.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
    expiry_date: stored.expiryDate,
  });

  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void GoogleAuth.updateOne(
      {},
      {
        $set: {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date ?? stored.expiryDate,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        },
      }
    );
  });

  return client;
}

export async function getGoogleConnectionStatus(): Promise<{ connected: boolean; email?: string }> {
  const stored = await GoogleAuth.findOne().select("googleEmail").lean();
  return stored ? { connected: true, email: stored.googleEmail } : { connected: false };
}

export async function disconnectGoogle(): Promise<void> {
  await GoogleAuth.deleteMany({});
}
