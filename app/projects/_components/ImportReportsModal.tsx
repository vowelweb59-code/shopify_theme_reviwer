"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { Modal } from "@/app/_components/ui/Modal";

type Summary = { created: number; alreadyImported: number; needsReview: { text: string; reason: string }[] };

const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";

/** Paste daily time reports from the Theme Status Group space; durations are suggested from them on each project. */
type ChatStatus = { configured: boolean; connection: { email: string; status: "active" | "revoked"; lastSyncAt: string | null; lastError: string | null } | null };
type SyncResult = Summary & { fetched: number; reports: number; connectedAs: string };

export function ImportReportsModal({
  open,
  onOpenChange,
  notice,
  autoSync = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notice?: { tone: "ok" | "error"; text: string } | null;
  /** Start importing from Google Chat as soon as the dialog opens (when it is connected). */
  autoSync?: boolean;
}) {
  const [chat, setChat] = useState<ChatStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const [team, setTeam] = useState<{ _id: string; name: string }[]>([]);
  const [memberId, setMemberId] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/team")
      .then((res) => res.json())
      .then((data) => setTeam(data.members ?? []))
      .catch(() => setError("Could not load the team."));
    fetch("/api/chat/sync")
      .then((res) => res.json())
      .then((status: ChatStatus) => {
        setChat(status);
        if (autoSync && status.connection?.status === "active") void handleSync();
      })
      .catch(() => setChat(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/chat/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setSyncError(data.error ?? "Syncing failed.");
      else setSyncResult(data);
    } catch {
      setSyncError("Lost connection to the server. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/chat-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, text }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to import the reports.");
        return;
      }
      setSummary(data);
      setText("");
    } catch {
      setError("Lost connection to the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Import from Google Chat" description="Reads the daily time reports in the Theme Status Group space. Reports already imported are skipped.">
      {notice && (
        <p role="status" className={`mb-3 text-sm ${notice.tone === "ok" ? "text-status-pass-text" : "text-status-fail-text"}`}>
          {notice.text}
        </p>
      )}
      <div className="mb-4 flex flex-col gap-2 rounded-md border border-border-subtle p-3 text-sm">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Automatic: Theme Status Group</p>
        {chat === null ? (
          <p className="text-xs text-zinc-500">Checking…</p>
        ) : !chat.configured ? (
          <p className="text-xs text-zinc-500">Google Chat isn&apos;t set up on this server yet.</p>
        ) : chat.connection?.status === "active" ? (
          <>
            <p className="text-xs text-zinc-500">
              Connected as {chat.connection.email}. {chat.connection.lastSyncAt ? `Last synced ${new Date(chat.connection.lastSyncAt).toLocaleString()}.` : "Not synced yet."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleSync} loading={syncing}>
                Sync now
              </Button>
              <a href="/api/chat/google/connect" className="self-center text-xs text-primary underline">
                Reconnect
              </a>
            </div>
          </>
        ) : (
          <>
            {chat.connection && <p className="text-xs text-status-fail-text">{chat.connection.lastError ?? "The connection was revoked."}</p>}
            <a href="/api/chat/google/connect" className="self-start rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]">
              Connect Google Chat
            </a>
          </>
        )}
        {syncError && <p className="text-xs text-status-fail-text">{syncError}</p>}
        {syncResult && (
          <div role="status" className="text-xs">
            <p className="text-status-pass-text">
              Read {syncResult.fetched} message{syncResult.fetched === 1 ? "" : "s"}, found {syncResult.reports} report{syncResult.reports === 1 ? "" : "s"}: imported {syncResult.created}
              {syncResult.alreadyImported > 0 ? `, ${syncResult.alreadyImported} already imported` : ""}.
            </p>
            {syncResult.needsReview.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
                {syncResult.needsReview.map((r, i) => (
                  <li key={i}>
                    Needs a look: {r.reason} <span className="text-zinc-400">— {r.text.split("\n").find((l) => /theme/i.test(l)) ?? r.text.slice(0, 60)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <details>
        <summary className="mb-3 cursor-pointer text-xs text-zinc-500">Or paste reports by hand</summary>
        <p className="mb-3 text-xs text-zinc-500">One person&apos;s reports at a time; a report starts at its Date line.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Posted by</span>
          <select required value={memberId} onChange={(e) => setMemberId(e.target.value)} className={INPUT}>
            <option value="" disabled>
              Choose a team member…
            </option>
            {team.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Reports</span>
          <textarea required rows={8} value={text} onChange={(e) => setText(e.target.value)} className={`${INPUT} font-mono text-xs`} placeholder={"Date: 22-10-2026\nTheme Name: Kombat | Gaming Theme | Theme Studio\nMemo: Worked on the product page\nTimer: 08.30 hrs"} />
        </label>
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text dark:border-red-900/50">{error}</div>}
        {summary && (
          <div role="status" className="flex flex-col gap-2 text-sm">
            <p className="text-status-pass-text">
              Imported {summary.created} report{summary.created === 1 ? "" : "s"}
              {summary.alreadyImported > 0 ? `; ${summary.alreadyImported} were already imported` : ""}.
            </p>
            {summary.needsReview.length > 0 && (
              <div className="rounded-md border border-border-subtle p-3 text-xs">
                <p className="mb-1 font-medium text-status-fail-text">Needs a look ({summary.needsReview.length}):</p>
                <ul className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
                  {summary.needsReview.map((r, i) => (
                    <li key={i}>
                      {r.reason} <span className="text-zinc-400">— {r.text.split("\n").find((l) => /theme/i.test(l)) ?? r.text.slice(0, 60)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="submit" loading={submitting}>
            Import
          </Button>
        </div>
      </form>
      </details>
    </Modal>
  );
}
