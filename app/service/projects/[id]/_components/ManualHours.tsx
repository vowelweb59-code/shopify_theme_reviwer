"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ManualHoursRow, ManualMember } from "@/lib/service/api/manual-hours";
import { mutate } from "@/lib/service/ui/client";
import { fmtLongDay, fmtMinutes } from "@/lib/service/ui/format";

// Adds hours to a project by hand (owner, 2026-11-23). They belong to the project and to nobody until allocated to a team member here.
export function ManualHours({ projectId, rows, members, today }: { projectId: string; rows: ManualHoursRow[]; members: ManualMember[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [member, setMember] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await mutate("POST", `/projects/${projectId}/manual-hours`, { date, hours, minutes, note, member });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setHours("");
    setMinutes("");
    setNote("");
    // Show the week (or month) the hours were dated in, so the Hours card visibly includes them.
    const q = new URLSearchParams(window.location.search);
    q.set("on", date);
    q.delete("week");
    router.push(`?${q}`);
    router.refresh();
  }

  async function allocate(id: string, to: string) {
    setError(null);
    const r = await mutate("PATCH", `/manual-hours/${id}`, { member: to });
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete these manual hours?")) return;
    setError(null);
    const r = await mutate("DELETE", `/manual-hours/${id}`);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  const input = "rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm";
  const total = rows.reduce((n, r) => n + r.minutes, 0);
  const unallocated = rows.filter((r) => !r.member).reduce((n, r) => n + r.minutes, 0);
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required className={input} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Hours</span>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={`${input} w-20`}
            placeholder="2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Minutes</span>
          <input
            type="number"
            min={0}
            max={59}
            step={1}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className={`${input} w-20`}
            placeholder="30"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={`${input} w-56`} placeholder="What the hours were for" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Allocate to</span>
          <select value={member} onChange={(e) => setMember(e.target.value)} className={input}>
            <option value="">Nobody (project only)</option>
            {members.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60">
          {busy ? "Adding…" : "Add hours"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-status-fail-text">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No manual hours on this project yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Hours</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2 font-medium">Allocated to</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2">{fmtLongDay(r.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMinutes(r.minutes)}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.note ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                  <td className="px-3 py-2">
                    <select
                      aria-label="Allocate to"
                      value={r.member ?? ""}
                      onChange={(e) => allocate(r.id, e.target.value)}
                      className={`${input} ${r.member ? "" : "text-zinc-500"}`}
                    >
                      <option value="">Nobody (project only)</option>
                      {r.member && !members.some((m) => m.key === r.member) && <option value={r.member}>{r.memberName}</option>}
                      {members.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => remove(r.id)} className="text-sm text-status-fail-text hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border-subtle px-3 py-2 text-xs text-zinc-500">
            {fmtMinutes(total)} in all, {fmtMinutes(unallocated)} not allocated to anyone. Unallocated hours count for the project (Everyone, revenue) but not
            for any team member or under &quot;My team only&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
