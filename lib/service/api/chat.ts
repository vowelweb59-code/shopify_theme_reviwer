import "server-only";
import { recordServiceAudit } from "../audit/record";
import { isServiceChatConfigured, serviceChatSpace } from "../chat/google";
import { ServiceChatConnection, ServiceChatSpace, ServiceSyncCheckpoint } from "@/models/service-chat";

export const SERVICE_CHAT_STATE_COOKIE = "service_chat_oauth_state";
export const serviceChatStateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const, // survives Google's top-level redirect back
  secure: process.env.NODE_ENV === "production",
  path: "/api/service/chat/google",
  maxAge: 10 * 60,
};

/** Back to the Service > Chat sync page with an outcome. Prefers APP_URL over the request origin (behind a proxy it can be internal). */
export function serviceChatReturnUrl(requestUrl: string, params: Record<string, string>): URL {
  const base = process.env.APP_URL?.replace(/\/+$/, "") || new URL(requestUrl).origin;
  const url = new URL("/service/chat", base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export type ServiceChatStatus = {
  configured: boolean;
  connected: boolean;
  account: string | null;
  connectedAt: string | null;
  space: string;
  lastSyncAt: string | null;
  lastError: string | null;
  lastResult: { month: string; fetched: number; entriesCreated: number; entriesUpdated: number; entriesKeptAsReviewed: number; entriesRemoved: number } | null;
  months: Array<{ month: string; syncedAt: string | null }>;
};

export async function chatStatus(): Promise<ServiceChatStatus> {
  const space = serviceChatSpace();
  const [conn, spaceRow] = await Promise.all([
    ServiceChatConnection.findOne({ key: "service-chat", status: "active" }).lean<{ email: string; createdAt: Date; lastSyncAt: Date | null; lastError: string | null; lastResult: ServiceChatStatus["lastResult"] } | null>(),
    ServiceChatSpace.findOne({ externalId: space }).select("_id").lean<{ _id: string } | null>(),
  ]);
  const checkpoints = spaceRow
    ? await ServiceSyncCheckpoint.find({ spaceId: spaceRow._id }).sort({ month: -1 }).limit(12).lean<Array<{ month: string; completedAt: Date | null; updatedAt: Date }>>()
    : [];
  return {
    configured: isServiceChatConfigured(),
    connected: !!conn,
    account: conn?.email ?? null,
    connectedAt: conn?.createdAt ? new Date(conn.createdAt).toISOString() : null,
    space,
    lastSyncAt: conn?.lastSyncAt ? new Date(conn.lastSyncAt).toISOString() : null,
    lastError: conn?.lastError ?? null,
    lastResult: conn?.lastResult ?? null,
    months: checkpoints.map((c) => ({ month: c.month, syncedAt: (c.completedAt ?? c.updatedAt)?.toISOString() ?? null })),
  };
}

export async function disconnectChat() {
  const r = await ServiceChatConnection.deleteOne({ key: "service-chat" });
  await recordServiceAudit("chat.disconnect", { removed: r.deletedCount });
  return { disconnected: r.deletedCount > 0 };
}
