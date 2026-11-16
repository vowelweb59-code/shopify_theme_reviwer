import "server-only";
import { withLease } from "@/lib/jobs/lease";
import { decryptSecret } from "@/lib/analytics/crypto";
import { googleErrorCode } from "@/lib/analytics/googleOAuth";
import { recordServiceAudit } from "../audit/record";
import { persistPlan } from "../import/persist";
import { planImport, type SpaceInput } from "../import/plan";
import { loadClientRegistry } from "../import/rematch";
import { filterPlanToDigitalMarketing, type DmProject } from "../import/dm-filter";
import { ServiceProject } from "@/models/service-project";
import { ServiceClient } from "@/models/service-client";
import { ServiceUser } from "@/models/service-user";
import { listServiceMessages, serviceChatSpace } from "./google";
import { istMonth, istMonthWindow } from "./months";
import { ServiceChatConnection, ServiceChatSender } from "@/models/service-chat";

// Reads one IST month of TIMER STATUS through the pure planner and the idempotent persist step. Used by the Sync button and the
// scheduler (this month every 15 minutes; once per IST day also last month, for late posts).

export async function serviceRefreshToken(): Promise<string> {
  const conn = await ServiceChatConnection.findOne({ key: "service-chat", status: "active" }).select("+encryptedRefreshToken").lean<{ encryptedRefreshToken: string | null } | null>();
  if (!conn?.encryptedRefreshToken) throw new Error("Google Chat is not connected for the service team yet.");
  return decryptSecret(conn.encryptedRefreshToken);
}

export const SERVICE_CHAT_REVOKED_MESSAGE = "Google access was removed or expired. Reconnect Chat on the Chat sync page.";

/**
 * Google answers `invalid_grant` when the connected account's refresh token is dead (access removed, password change, expiry).
 * Retrying every 15 minutes can never succeed, so mark the connection revoked (the schedulers skip it) and return the message
 * to show. Returns null for any other error. Used by the service sync and the attendance sync, which share this connection.
 */
export async function noteIfGoogleAccessLost(err: unknown): Promise<string | null> {
  if (googleErrorCode(err) !== "invalid_grant") return null;
  await ServiceChatConnection.updateOne({ key: "service-chat" }, { $set: { status: "revoked", lastError: SERVICE_CHAT_REVOKED_MESSAGE } });
  return SERVICE_CHAT_REVOKED_MESSAGE;
}

/** One import per IST month at a time, whether it comes from the button or the scheduler (or a second server instance). */
export async function syncServiceMonth(month: string, trigger: "manual" | "auto") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM.");
  const leased = await withLease(`service-sync:${month}`, 15 * 60_000, () => runServiceMonth(month, trigger));
  if (!leased.ran) throw new Error(`A sync of ${month} is already running. Try again in a minute.`);
  return leased.value;
}

async function runServiceMonth(month: string, trigger: "manual" | "auto") {
  const space = serviceChatSpace();
  try {
    const messages = await listServiceMessages(await serviceRefreshToken(), space, istMonthWindow(month));
    const spaces: SpaceInput[] = [{ externalId: space, name: "Timer Status", type: "TIMER_STATUS", messages }];
    // Owner, 2026-11-16: keep the Digital Marketing people's hours plus anyone's hours on a project the team works on.
    const plan = filterPlanToDigitalMarketing(planImport({ month, spaces, clients: await loadClientRegistry() }), await loadDmProjects());
    const saved = await persistPlan(plan, spaces);
    const result = { month, fetched: messages.length, summary: plan.summary, saved };
    await ServiceChatConnection.updateOne({ key: "service-chat" }, { $set: { lastSyncAt: new Date(), lastResult: { month, fetched: messages.length, ...saved }, lastError: null } });
    await recordServiceAudit(trigger === "manual" ? "chat.sync" : "chat.auto_sync", { month, fetched: messages.length, ...saved });
    return result;
  } catch (err) {
    const lost = await noteIfGoogleAccessLost(err);
    const message = lost ?? (err instanceof Error ? err.message : String(err));
    if (!lost) await ServiceChatConnection.updateOne({ key: "service-chat" }, { $set: { lastError: message } });
    throw lost ? new Error(lost) : err;
  }
}

/** The projects on this site (after the 2026-11-16 migration, the Digital Marketing team's) with what ties an entry to each. */
async function loadDmProjects(): Promise<DmProject[]> {
  const [projects, clients, users, senders] = await Promise.all([
    ServiceProject.find({ clientId: { $ne: null } }).select("clientId chatKeywords people assignments")
      .lean<Array<{ _id: string; clientId: string; chatKeywords: string[]; people: Array<{ name: string; senderId: string | null }>; assignments: Array<{ userId: string }> }>>(),
    ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>(),
    ServiceUser.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
    ServiceChatSender.find().select("displayName userId").lean<Array<{ _id: string; displayName: string; userId: string | null }>>(),
  ]);
  const clientNames = new Map(clients.map((c) => [c._id, [c.name, ...c.aliases]]));
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  const senderName = new Map(senders.map((s) => [s._id, s.displayName]));
  const sendersOfUser = new Map<string, string[]>();
  for (const s of senders) if (s.userId) sendersOfUser.set(s.userId, [...(sendersOfUser.get(s.userId) ?? []), s.displayName]);
  return projects.map((p) => ({
    id: p._id,
    clientId: p.clientId,
    clientNames: clientNames.get(p.clientId) ?? [],
    keywords: p.chatKeywords,
    teamNames: [
      ...p.people.flatMap((x) => [x.name, x.senderId ? senderName.get(x.senderId) : undefined]),
      ...p.assignments.flatMap((a) => [userName.get(a.userId), ...(sendersOfUser.get(a.userId) ?? [])]),
    ].filter((n): n is string => !!n),
  }));
}

export { istMonth };
