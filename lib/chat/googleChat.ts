import "server-only";
import { OAuth2Client } from "google-auth-library";

// Reading the Theme Status Group space through the Google Chat API, as the
// Google account that connected. Same OAuth client as the Sheets export and
// GA4 (GOOGLE_CLIENT_ID/SECRET) but its own consent flow, scopes and
// callback. Read-only: messages and the member list (to turn "users/123"
// into a name). Server-side only.

export const CHAT_MESSAGES_SCOPE = "https://www.googleapis.com/auth/chat.messages.readonly";
export const CHAT_MEMBERSHIPS_SCOPE = "https://www.googleapis.com/auth/chat.memberships.readonly";
export const CHAT_OAUTH_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", CHAT_MESSAGES_SCOPE, CHAT_MEMBERSHIPS_SCOPE];

export const CHAT_OAUTH_CALLBACK_PATH = "/api/chat/google/callback";
/** The Theme Status Group space (from its chat.google.com/room/<id> link); override with GOOGLE_CHAT_SPACE. */
export const DEFAULT_CHAT_SPACE = "AAQAo4521kg";

export class ChatOAuthError extends Error {
  constructor(
    public readonly code: "not_configured" | "missing_scope" | "invalid_identity" | "token_exchange_failed",
    message: string
  ) {
    super(message);
    this.name = "ChatOAuthError";
  }
}

type Env = Record<string, string | undefined>;

export function isChatConfigured(env: Env = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ANALYTICS_TOKEN_ENCRYPTION_KEY && (env.CHAT_OAUTH_REDIRECT_URI || env.APP_URL));
}

export function getChatRedirectUri(env: Env = process.env): string {
  if (env.CHAT_OAUTH_REDIRECT_URI) return env.CHAT_OAUTH_REDIRECT_URI;
  if (env.APP_URL) return `${env.APP_URL.replace(/\/+$/, "")}${CHAT_OAUTH_CALLBACK_PATH}`;
  throw new ChatOAuthError("not_configured", "Set APP_URL (or CHAT_OAUTH_REDIRECT_URI) to connect Google Chat.");
}

export function getChatSpace(env: Env = process.env): string {
  return (env.GOOGLE_CHAT_SPACE ?? DEFAULT_CHAT_SPACE).replace(/^spaces\//, "");
}

export function createChatOAuthClient(env: Env = process.env): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new ChatOAuthError("not_configured", "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getChatRedirectUri(env));
}

export function buildChatAuthUrl(state: string, client: OAuth2Client = createChatOAuthClient()): string {
  return client.generateAuthUrl({ access_type: "offline", prompt: "select_account consent", scope: CHAT_OAUTH_SCOPES, state });
}

export type ChatOAuthResult = {
  googleAccountId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
  expiryDate: Date;
  scopes: string[];
};

export async function exchangeChatCode(code: string, client: OAuth2Client = createChatOAuthClient()): Promise<ChatOAuthResult> {
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch {
    throw new ChatOAuthError("token_exchange_failed", "Google rejected the sign-in. Try connecting again.");
  }
  if (!tokens.access_token || !tokens.expiry_date) throw new ChatOAuthError("token_exchange_failed", "Google returned an incomplete token set. Try connecting again.");

  const scopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(CHAT_MESSAGES_SCOPE)) throw new ChatOAuthError("missing_scope", "Reading Chat messages wasn't granted. Reconnect and leave every checkbox ticked.");

  if (!tokens.id_token) throw new ChatOAuthError("invalid_identity", "Google didn't identify the account. Try connecting again.");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: client._clientId }).catch(() => null);
  const payload = ticket?.getPayload();
  if (!payload?.sub || !payload.email) throw new ChatOAuthError("invalid_identity", "Couldn't verify which Google account signed in. Try connecting again.");

  return { googleAccountId: payload.sub, email: payload.email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null, expiryDate: new Date(tokens.expiry_date), scopes };
}

// --- reading the space -------------------------------------------------------

export type SpaceMessage = { id: string; senderId: string; senderName: string; createTime: string; text: string };
type Fetcher = typeof fetch;

const API = "https://chat.googleapis.com/v1";
const MAX_PAGES = 50; // 50 x 1000 messages: a backstop against a runaway loop, far more than a space needs

async function getJson(fetcher: Fetcher, url: string, accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetcher(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    // Google's error body can echo request details; the status and its own short message are enough.
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new Error(`Google Chat API ${res.status}${body.error?.status ? ` ${body.error.status}` : ""}: ${body.error?.message ?? "request failed"}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** users/123 -> display name, from the space's member list (empty if that permission wasn't granted). */
export async function listMemberNames(space: string, accessToken: string, fetcher: Fetcher = fetch): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let pageToken = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = (await getJson(fetcher, `${API}/spaces/${space}/members?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, accessToken)) as {
      memberships?: { member?: { name?: string; displayName?: string } }[];
      nextPageToken?: string;
    };
    for (const m of data.memberships ?? []) if (m.member?.name && m.member.displayName) names.set(m.member.name, m.member.displayName);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return names;
}

/** Messages in the space created after `since` (all of them when null), oldest first. */
export async function listSpaceMessages(space: string, accessToken: string, since: Date | null, memberNames: Map<string, string>, fetcher: Fetcher = fetch): Promise<SpaceMessage[]> {
  const out: SpaceMessage[] = [];
  let pageToken = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ pageSize: "1000", orderBy: "createTime asc" });
    if (since) params.set("filter", `createTime > "${since.toISOString()}"`);
    if (pageToken) params.set("pageToken", pageToken);
    const data = (await getJson(fetcher, `${API}/spaces/${space}/messages?${params}`, accessToken)) as {
      messages?: { name?: string; text?: string; createTime?: string; sender?: { name?: string; displayName?: string; type?: string } }[];
      nextPageToken?: string;
    };
    for (const m of data.messages ?? []) {
      if (!m.name || !m.createTime || !m.text || m.sender?.type === "BOT") continue;
      const senderId = m.sender?.name ?? "";
      out.push({ id: m.name, senderId, senderName: m.sender?.displayName || memberNames.get(senderId) || "", createTime: m.createTime, text: m.text });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}
