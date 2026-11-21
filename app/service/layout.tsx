import type { ReactNode } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { connectToDatabase } from "@/lib/db/connect";
import { ServiceChatConnection } from "@/models/service-chat";
import { ServiceNav } from "./_components/ServiceNav";

// Service Team: the Upwork client-work operation (hours from the TIMER STATUS Chat space, clients, contracts, review),
// ported from the Upwork Project-Management app. Its data lives in service_* collections, apart from the theme team's.
export const dynamic = "force-dynamic";

const when = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const ago = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.floor(h / 24)} days ago`;
};

/** When the TIMER STATUS space was last read (owner, 2026-11-20: "bring last sync time here"). The sync runs every 15 minutes while the server is awake. */
async function lastSync() {
  try {
    await connectToDatabase();
    const c = await ServiceChatConnection.findOne({ key: "service-chat" })
      .select("status lastSyncAt")
      .lean<{ status: string; lastSyncAt: Date | null } | null>();
    if (!c) return { text: "Chat not connected", tone: "text-status-fail-text" };
    if (c.status === "revoked") return { text: "Chat connection stopped: reconnect in Settings", tone: "text-status-fail-text" };
    if (!c.lastSyncAt) return { text: "Not synced yet", tone: "text-zinc-500" };
    const age = Date.now() - new Date(c.lastSyncAt).getTime();
    // The sync is due every 15 minutes: past an hour something is not running (the server may be asleep).
    return { text: `Last synced ${when(new Date(c.lastSyncAt))} IST · ${ago(age)}`, tone: age > 60 * 60_000 ? "text-status-warning-text" : "text-zinc-500" };
  } catch {
    return null;
  }
}

export default async function ServiceLayout({ children }: { children: ReactNode }) {
  const sync = await lastSync();
  return (
    <PageContainer className="max-w-7xl gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Service Team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Hours are reported and tracked in the TIMER STATUS Chat space, not Upwork-verified billable hours.
          {sync && (
            <span
              className={`ml-2 whitespace-nowrap font-medium ${sync.tone}`}
              title="The TIMER STATUS space is read every 15 minutes while the server is awake"
            >
              ● {sync.text}
            </span>
          )}
        </p>
      </div>
      <ServiceNav />
      {children}
    </PageContainer>
  );
}
