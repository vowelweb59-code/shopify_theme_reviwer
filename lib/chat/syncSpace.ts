import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/analytics/crypto";
import { googleErrorCode } from "@/lib/analytics/googleOAuth";
import { withLease } from "@/lib/jobs/lease";
import { istDay } from "@/lib/time/ist";
import { ChatConnection } from "@/models/chat-connection";
import { createChatOAuthClient, getChatSpace, listMemberNames, listSpaceMessages } from "./googleChat";
import { importReports, type ImportSummary } from "./importReports";

export type SyncResult = ImportSummary & { fetched: number; reports: number; connectedAs: string };

const REFRESH_MARGIN_MS = 60_000;

type ConnectionDoc = NonNullable<Awaited<ReturnType<typeof loadConnection>>>;

async function loadConnection() {
  return ChatConnection.findOne({ key: "chat" }).select("+encryptedAccessToken +encryptedRefreshToken");
}

/** A valid access token for the connected account, refreshed (and saved) when it is about to expire. */
export async function chatAccessToken(connection: ConnectionDoc): Promise<string> {
  let accessToken = connection.encryptedAccessToken ? decryptSecret(connection.encryptedAccessToken) : "";
  const refreshToken = connection.encryptedRefreshToken ? decryptSecret(connection.encryptedRefreshToken) : null;
  if (!accessToken || !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS) {
    if (!refreshToken) throw Object.assign(new Error("No refresh token."), { response: { data: { error: "invalid_grant" } } });
    const client = createChatOAuthClient();
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

/** How far back each sync re-reads, to catch edited messages (importing is idempotent, so unchanged ones cost nothing). */
const EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** A message is a time report when it has a filled-in Theme Name line; other chatter (and the blank template) is ignored. */
export function looksLikeReport(text: string): boolean {
  // The posts that explain how to write a report (the format guide with its "DD-MM-YYYY" and example lines) are not reports.
  if (/\bDD-MM-YYYY\b|types of work reports|do not rename fields|description of work completed/i.test(text)) return false;
  return /theme\s*name\s*[:\-–—][\s:\-–—]*(?!memo\b|timer?\b)[^\s:\-–—]/i.test(text);
}

/**
 * Reads the space's new messages as the connected Google account and imports
 * every time report among them (lib/chat/importReports.ts). Only messages
 * newer than the last sync are fetched; importing is idempotent, so an
 * interrupted run is simply repeated. Throws a message-only Error for the
 * route to show.
 */
export async function syncSpace(options: { all?: boolean } = {}): Promise<SyncResult> {
  // One read at a time across the scheduler, the Sync button and a second server instance.
  const leased = await withLease("theme-chat-sync", 10 * 60_000, () => readSpace(options));
  if (!leased.ran) throw new Error("A Google Chat sync is already running. Try again in a minute.");
  return leased.value;
}

async function readSpace(options: { all?: boolean }): Promise<SyncResult> {
  const connection = await loadConnection();
  if (!connection || connection.status !== "active") throw new Error("Google Chat isn't connected. Connect it first.");

  try {
    const accessToken = await chatAccessToken(connection);

    const space = getChatSpace();
    // Names are a convenience (the sender usually carries one); without the memberships permission they are just empty.
    const memberNames = await listMemberNames(space, accessToken).catch(() => new Map<string, string>());
    // Messages are read from a few days before the last one seen, so a message edited since it was imported is read again.
    const since = options.all || !connection.lastMessageAt ? null : new Date(new Date(connection.lastMessageAt).getTime() - EDIT_WINDOW_MS);
    const messages = await listSpaceMessages(space, accessToken, since, memberNames);
    const reports = messages.filter((m) => looksLikeReport(m.text));

    const summary = await importReports(reports.map((m) => ({ sender: m.senderName, text: m.text, postedOn: istDay(new Date(m.createTime)), postedAt: m.createTime, messageId: m.id })));

    const newest = messages.reduce<Date | null>((latest, m) => {
      const at = new Date(m.createTime);
      return !latest || at > latest ? at : latest;
    }, connection.lastMessageAt ?? null);
    connection.lastMessageAt = newest;
    connection.lastSyncAt = new Date();
    connection.lastError = null;
    await connection.save();

    return { ...summary, fetched: messages.length, reports: reports.length, connectedAs: connection.email };
  } catch (err) {
    if (googleErrorCode(err) === "invalid_grant") {
      connection.status = "revoked";
      connection.lastError = "Google access was removed or expired. Reconnect Google Chat.";
      await connection.save();
      throw new Error(connection.lastError as string);
    }
    const message = err instanceof Error ? err.message : "Syncing failed.";
    connection.lastError = message.slice(0, 300);
    await connection.save();
    throw new Error(message);
  }
}
