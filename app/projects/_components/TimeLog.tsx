"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { formatDateOnly } from "@/app/_components/formatDate";
import { MAX_HOURS_PER_ENTRY } from "@/lib/projects/constants";

type Entry = { _id: string; memberId: string; memberName: string; date: string; hours: number; note: string };
type Log = { entries: Entry[]; totalHours: number; byMember: { memberId: string; name: string; hours: number }[] };

const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-2";
// Local calendar date (en-CA formats as YYYY-MM-DD); toISOString would give the UTC day.
const today = () => new Date().toLocaleDateString("en-CA");

/** The hours log of a Theme Update project: who worked how long on which day, with the running total. */
export function TimeLog({ projectId, members }: { projectId: string; members: { memberId: string; name: string }[] }) {
  const [log, setLog] = useState<Log | null>(null);
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/time`)
      .then((res) => res.json())
      .then(setLog)
      .catch(() => setError("Couldn't load the time log."));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, date, hours: Number(hours), note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to log the hours.");
        return;
      }
      setHours("");
      setNote("");
      load();
    } catch {
      setError("Lost connection to the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entry: Entry) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/time/${entry._id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to delete the entry.");
      return;
    }
    load();
  }

  return (
    <Card>
      <CardHeader
        title="Hours"
        description="Time spent on this theme's ongoing updates."
        action={
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Clock className="h-4 w-4" aria-hidden />
            <span>
              Total <strong className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{log?.totalHours ?? 0}</strong> h
            </span>
          </div>
        }
      />

      {members.length === 0 ? (
        <p className="text-sm text-zinc-500">Add team members to the project below first, then log their hours here.</p>
      ) : (
        <form onSubmit={handleAdd} className="mb-5 grid gap-3 sm:grid-cols-[1fr_9rem_6rem_2fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Team member</span>
            <select required value={memberId} onChange={(e) => setMemberId(e.target.value)} className={INPUT}>
              <option value="" disabled>
                Choose…
              </option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Date</span>
            <input required type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Hours</span>
            <input required type="number" inputMode="decimal" min={0.25} max={MAX_HOURS_PER_ENTRY} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">What was done (optional)</span>
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={INPUT} />
          </label>
          <Button type="submit" loading={submitting}>
            Log hours
          </Button>
        </form>
      )}

      {error && <div className="mb-4 rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text dark:border-red-900/50">{error}</div>}

      {log && log.byMember.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {log.byMember.map((m) => (
            <span key={m.memberId} className="rounded-full bg-surface-muted px-3 py-1 text-xs text-zinc-700 dark:text-zinc-300">
              {m.name}: <strong>{m.hours} h</strong>
            </span>
          ))}
        </div>
      )}

      {!log ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : log.entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No hours logged yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {log.entries.map((e) => (
            <li key={e._id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-28 shrink-0 text-zinc-500">{formatDateOnly(e.date)}</span>
              <span className="w-40 shrink-0 font-medium text-zinc-900 dark:text-zinc-100">{e.memberName}</span>
              <span className="w-14 shrink-0 tabular-nums">{e.hours} h</span>
              <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-400" title={e.note}>
                {e.note}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(e)}
                aria-label={`Delete ${e.hours} hours by ${e.memberName} on ${formatDateOnly(e.date)}`}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-black/[.04] hover:text-red-700 dark:hover:bg-white/[.06]"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
