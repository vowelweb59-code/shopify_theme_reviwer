import "server-only";
import { OAuth2Client } from "google-auth-library";
import type { RawChatMessage } from "../import/plan";

// Reads the service team's TIMER STATUS space through the Google Chat API, as the Google account that connected on the
// Service > Chat sync page. Same OAuth client as the rest of the app (GOOGLE_CLIENT_ID/SECRET) but its own consent flow,
// callback and stored connection (ServiceChatConnection), apart from the theme team's Theme Status Group connection.

export const SERVICE_CHAT_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.memberships.readonly",
];
export const SERVICE_CHAT_CALLBACK_PATH = "/api/service/chat/google/callback";
/** TIMER STATUS; override with SERVICE_CHAT_SPACE. */
export const DEFAULT_SERVICE_CHAT_SPACE = "spaces/AAAAZ1MQ5aQ";

type Env = Record<string, string | undefined>;

export function serviceChatSpace(env: Env = process.env): string {
  const s = (env.SERVICE_CHAT_SPACE ?? DEFAULT_SERVICE_CHAT_SPACE).trim();
  return s.startsWith("spaces/") ? s : `spaces/${s}`;
}

/**
 * The OAuth client TIMER STATUS is read with. SERVICE_GOOGLE_CLIENT_ID/SECRET (e.g. the "ops-web" client in the
 * Upwork-Ops-Platform Google Cloud project) take precedence; otherwise the app-wide GOOGLE_CLIENT_ID/SECRET is used.
 */
function credentials(env: Env): { id: string; secret: string } | null {
  // Trimmed: a pasted dashboard value with a trailing space or newline makes Google answer invalid_client.
  const pair = (id?: string, secret?: string) => (id?.trim() && secret?.trim() ? { id: id.trim(), secret: secret.trim() } : null);
  return pair(env.SERVICE_GOOGLE_CLIENT_ID, env.SERVICE_GOOGLE_CLIENT_SECRET) ?? pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
}

export function isServiceChatConfigured(env: Env = process.env): boolean {
  return Boolean(credentials(env) && env.ANALYTICS_TOKEN_ENCRYPTION_KEY && (env.SERVICE_CHAT_OAUTH_REDIRECT_URI || env.APP_URL));
}

function redirectUri(env: Env = process.env): string {
  if (env.SERVICE_CHAT_OAUTH_REDIRECT_URI) return env.SERVICE_CHAT_OAUTH_REDIRECT_URI;
  if (env.APP_URL) return `${env.APP_URL.replace(/\/+$/, "")}${SERVICE_CHAT_CALLBACK_PATH}`;
  throw new Error("Set APP_URL (or SERVICE_CHAT_OAUTH_REDIRECT_URI) to connect Google Chat.");
}

export function serviceChatOAuthClient(env: Env = process.env): OAuth2Client {
  const c = credentials(env);
  if (!c) throw new Error("SERVICE_GOOGLE_CLIENT_ID / SERVICE_GOOGLE_CLIENT_SECRET (or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not set.");
  return new OAuth2Client(c.id, c.secret, redirectUri(env));
}

export function serviceChatAuthUrl(state: string, client = serviceChatOAuthClient()): string {
  return client.generateAuthUrl({ access_type: "offline", prompt: "select_account consent", scope: SERVICE_CHAT_SCOPES, state });
}

export async function exchangeServiceChatCode(code: string, client = serviceChatOAuthClient()) {
  const { tokens } = await client.getToken(code);
  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes("https://www.googleapis.com/auth/chat.messages.readonly")) throw new Error("Reading Chat messages wasn't granted. Reconnect and leave every checkbox ticked.");
  if (!tokens.id_token) throw new Error("Google didn't identify the account. Try connecting again.");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: client._clientId }).catch(() => null);
  const payload = ticket?.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Couldn't verify which Google account signed in. Try connecting again.");
  return { googleAccountId: payload.sub, email: payload.email, refreshToken: tokens.refresh_token ?? null, scopes };
}

async function accessToken(refreshToken: string): Promise<string> {
  const client = serviceChatOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Google returned no access token. Reconnect Chat.");
  return token;
}

const API = "https://chat.googleapis.com/v1";
const MAX_PAGES = 200; // 200 x 1000 messages: a hard stop against a paging loop

async function getJson<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new Error(`Google Chat API ${res.status}${body.error?.status ? ` ${body.error.status}` : ""}: ${body.error?.message ?? "request failed"}`);
  }
  return (await res.json()) as T;
}

/** users/123 -> display name, from the space's member list (Chat leaves displayName empty on messages read as a user). */
async function memberNames(token: string, space: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let pageToken = "";
  for (let i = 0; i < MAX_PAGES; i++) {
    const r = await getJson<{ memberships?: Array<{ member?: { name?: string; displayName?: string } }>; nextPageToken?: string }>(
      token, `${API}/${space}/members?pageSize=1000&showGroups=false${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`
    ).catch(() => ({ memberships: [], nextPageToken: undefined }));
    for (const m of r.memberships ?? []) if (m.member?.name && m.member.displayName) names.set(m.member.name, m.member.displayName);
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return names;
}

/** Text messages created in [from, to), oldest first. Edited messages come back with their latest text. */
export async function listServiceMessages(refreshToken: string, space: string, { from, to }: { from: Date; to: Date }): Promise<RawChatMessage[]> {
  const token = await accessToken(refreshToken);
  const names = await memberNames(token, space);
  const filter = `createTime > "${new Date(from.getTime() - 1000).toISOString()}" AND createTime < "${to.toISOString()}"`;
  const out: RawChatMessage[] = [];
  let pageToken = "";
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({ pageSize: "1000", orderBy: "createTime ASC", filter, ...(pageToken ? { pageToken } : {}) });
    const r = await getJson<{ messages?: Array<{ name?: string; createTime?: string; text?: string; sender?: { name?: string; displayName?: string; type?: string } }>; nextPageToken?: string }>(token, `${API}/${space}/messages?${params}`);
    for (const m of r.messages ?? []) {
      if (!m.name || !m.createTime || !m.text || m.sender?.type === "BOT") continue;
      const sender = m.sender?.name ?? "unknown";
      out.push({ externalId: m.name, senderExternalId: sender, senderName: m.sender?.displayName || names.get(sender) || sender, postedAt: m.createTime, text: m.text });
    }
    if (!r.nextPageToken) return out;
    pageToken = r.nextPageToken;
  }
  throw new Error("Chat returned too many pages; stopping");
}

// Shared with the attendance page (lib/attendance/chat.ts), which reads its own space through this same connection.
export const serviceChatToken = accessToken;
export const serviceChatGet = getJson;
