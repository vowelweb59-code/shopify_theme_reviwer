import "server-only";
import { decryptSecret } from "@/lib/analytics/crypto";
import { recordServiceAudit } from "../audit/record";
import { persistPlan } from "../import/persist";
import { planImport, type SpaceInput } from "../import/plan";
import { loadClientRegistry } from "../import/rematch";
import { listServiceMessages, serviceChatSpace } from "./google";
import { istMonth, istMonthWindow } from "./months";
import { ServiceChatConnection } from "@/models/service-chat";

// Reads one IST month of TIMER STATUS through the pure planner and the idempotent persist step. Used by the Sync button and the
// scheduler (this month every 15 minutes; once per IST day also last month, for late posts).

export async function serviceRefreshToken(): Promise<string> {
  const conn = await ServiceChatConnection.findOne({ key: "service-chat", status: "active" }).select("+encryptedRefreshToken").lean<{ encryptedRefreshToken: string | null } | null>();
  if (!conn?.encryptedRefreshToken) throw new Error("Google Chat is not connected for the service team yet.");
  return decryptSecret(conn.encryptedRefreshToken);
}

export async function syncServiceMonth(month: string, trigger: "manual" | "auto") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM.");
  const space = serviceChatSpace();
  try {
    const messages = await listServiceMessages(await serviceRefreshToken(), space, istMonthWindow(month));
    const spaces: SpaceInput[] = [{ externalId: space, name: "Timer Status", type: "TIMER_STATUS", messages }];
    const plan = planImport({ month, spaces, clients: await loadClientRegistry() });
    const saved = await persistPlan(plan, spaces);
    const result = { month, fetched: messages.length, summary: plan.summary, saved };
    await ServiceChatConnection.updateOne({ key: "service-chat" }, { $set: { lastSyncAt: new Date(), lastResult: { month, fetched: messages.length, ...saved }, lastError: null } });
    await recordServiceAudit(trigger === "manual" ? "chat.sync" : "chat.auto_sync", { month, fetched: messages.length, ...saved });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ServiceChatConnection.updateOne({ key: "service-chat" }, { $set: { lastError: message } });
    throw err;
  }
}

export { istMonth };
