"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { Modal } from "@/app/_components/ui/Modal";

type Summary = { created: number; alreadyImported: number; needsReview: { text: string; reason: string }[] };

const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";

/** Paste daily time reports from the Theme Status Group space; durations are suggested from them on each project. */
export function ImportReportsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
  }, [open]);

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
    <Modal open={open} onOpenChange={onOpenChange} title="Import time reports" description="Paste reports from the Theme Status Group space. One person's reports at a time; a report starts at its Date line.">
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
    </Modal>
  );
}
