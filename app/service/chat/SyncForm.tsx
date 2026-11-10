"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";
import { INPUT } from "@/lib/service/ui/format";

type SyncResult = {
  month: string;
  fetched: number;
  saved: { messages: number; entriesCreated: number; entriesUpdated: number; entriesKeptAsReviewed: number; entriesRemoved: number };
};

const BUTTON = "rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:opacity-60";

export function SyncForm({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 7)); // current IST month
  const [busy, setBusy] = useState<"sync" | "reread" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sync(e: React.FormEvent) {
    e.preventDefault();
    setBusy("sync");
    setError(null);
    setMessage(null);
    const r = await mutate<SyncResult>("POST", "/chat/sync", { month });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    const s = r.data.saved;
    setMessage(`${r.data.month}: ${r.data.fetched} messages read. ${s.entriesCreated} new, ${s.entriesUpdated} updated, ${s.entriesKeptAsReviewed} kept as reviewed, ${s.entriesRemoved} removed.`);
    router.refresh();
  }

  async function reread() {
    setBusy("reread");
    setError(null);
    setMessage(null);
    const r = await mutate<{ matched: number }>("POST", "/chat/reread");
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setMessage(`Rules applied again. ${r.data.matched} entries matched a client.`);
    router.refresh();
  }

  return (
    <form onSubmit={sync} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Month</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required className={INPUT} />
      </label>
      <button disabled={!connected || busy !== null || !month} className={BUTTON}>{busy === "sync" ? "Importing…" : "Import month"}</button>
      <button type="button" onClick={reread} disabled={busy !== null} className={BUTTON} title="No Google call: re-applies client matching and project placement to stored entries">
        {busy === "reread" ? "Applying…" : "Re-apply rules"}
      </button>
      {!connected && <p className="basis-full text-sm text-zinc-500">Connect Google Chat to import. Re-applying the rules works without a connection.</p>}
      {error && <p role="alert" className="basis-full text-sm text-status-fail-text">{error}</p>}
      {message && <p role="status" className="basis-full text-sm">{message}</p>}
    </form>
  );
}
