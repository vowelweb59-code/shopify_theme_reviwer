import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/analytics/crypto";
import { googleErrorCode } from "@/lib/analytics/googleOAuth";
import { ChatConnection } from "@/models/chat-connection";
import { createChatOAuthClient, getChatSpace, listMemberNames, listSpaceMessages } from "./googleChat";
import { importReports, type ImportSummary } from "./importReports";

export type SyncResult = ImportSummary & { fetched: number; reports: number; connectedAs: string };

const REFRESH_MARGIN_MS = 60_000;

/** A message is a time report when it has a Theme Name line; other chatter in the space is ignored. */
export function looksLikeReport(text: string): boolean {
  return /theme\s*name/i.test(text);
}

/**
 * Reads the space's new messages as the connected Google account and imports
 * every time report among them (lib/chat/importReports.ts). Only messages
 * newer than the last sync are fetched; importing is idempotent, so an
 * interrupted run is simply repeated. Throws a message-only Error for the
 * route to show.
 */
export async function syncSpace(): Promise<SyncResult> {
  const connection = await ChatConnection.findOne({ key: "chat" }).select("+encryptedAccessToken +encryptedRefreshToken");
  if (!connection || connection.status !== "active") throw new Error("Google Chat isn't connected. Connect it first.");

  let accessToken = connection.encryptedAccessToken ? decryptSecret(connection.encryptedAccessToken) : "";
  const refreshToken = connection.encryptedRefreshToken ? decryptSecret(connection.encryptedRefreshToken) : null;

  try {
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

    const space = getChatSpace();
    // Names are a convenience (the sender usually carries one); without the memberships permission they are just empty.
    const memberNames = await listMemberNames(space, accessToken).catch(() => new Map<string, string>());
    const messages = await listSpaceMessages(space, accessToken, connection.lastMessageAt ?? null, memberNames);
    const reports = messages.filter((m) => looksLikeReport(m.text));

    const summary = await importReports(reports.map((m) => ({ sender: m.senderName, text: m.text })));

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
