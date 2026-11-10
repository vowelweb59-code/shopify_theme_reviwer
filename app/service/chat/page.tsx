import { Card, CardHeader } from "@/app/_components/ui/Card";
import { load } from "@/lib/service/api/http";
import { chatStatus } from "@/lib/service/api/chat";
import { SyncForm } from "./SyncForm";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "never");

export default async function ServiceChatPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams;
  const s = await load(chatStatus);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-zinc-500">
        Reads the TIMER STATUS space as the connected Google account (read-only) and imports one month at a time. Imports can be repeated safely: nothing is
        counted twice, edited messages keep their latest text, and entries a person reviewed are kept. While connected, this month is read every 15 minutes
        and last month once a day. This connection is separate from the theme team&apos;s Theme Status Group.
      </p>

      {connected && <p role="status" className="rounded-md bg-status-pass-bg p-3 text-sm text-status-pass-text">Chat connected.</p>}
      {error && <p role="alert" className="rounded-md bg-status-fail-bg p-3 text-sm text-status-fail-text">{error}</p>}

      <Card>
        <CardHeader title="Connection" />
        {!s.configured ? (
          <p className="text-sm text-status-warning-text">Not set up on the server: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANALYTICS_TOKEN_ENCRYPTION_KEY and APP_URL must be set.</p>
        ) : s.connected ? (
          <div className="space-y-1 text-sm">
            <p>
              Connected as <span className="font-medium">{s.account}</span>. Space: <code>{s.space}</code>
            </p>
            <p className="text-zinc-500">
              Last sync: {when(s.lastSyncAt)}
              {s.lastResult && ` (${s.lastResult.month}: ${s.lastResult.fetched} messages, ${s.lastResult.entriesCreated} new)`}
            </p>
            {s.lastError && <p className="text-status-fail-text">Last error: {s.lastError}</p>}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Not connected. Sign in with a Google account that is a member of the TIMER STATUS space.</p>
        )}
        {s.configured && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/service/chat/google/connect" className="rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium hover:bg-surface-muted">
              {s.connected ? "Reconnect" : "Connect Google Chat"}
            </a>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Import a month" description="Reads the month from Google Chat, then places, lists and holds projects by the usual rules." />
        <SyncForm connected={s.connected} />
        {s.months.length > 0 && <p className="mt-3 text-xs text-zinc-500">Imported before: {s.months.map((m) => m.month).join(", ")}</p>}
      </Card>
    </div>
  );
}
