"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";
import { fmtMinutes, INPUT } from "@/lib/service/ui/format";
import type { ReviewEntry, ReviewProject } from "@/lib/service/api/review";
import { BTN, SECTION, flagLabel } from "./shared";

const IST = "+05:30";
type ClientOption = { id: string; name: string };

/**
 * The rows of the review page. The client and project lists arrive once here (not once per row) and the client picker
 * is a typed field over one shared list: with well over a thousand clients a list per row made the page tens of megabytes.
 */
export function ReviewEntries({ entries, clients, projects }: { entries: ReviewEntry[]; clients: ClientOption[]; projects: ReviewProject[] }) {
  return (
    <>
      <datalist id="service-review-clients">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      {entries.map((e) => <ReviewRow key={e.id} entry={e} clients={clients} projects={projects} />)}
    </>
  );
}

/** One entry awaiting review, with the original Chat text beside the actions so the reviewer can check it. */
function ReviewRow({ entry: e, clients, projects }: { entry: ReviewEntry; clients: ClientOption[]; projects: ReviewProject[] }) {
  const router = useRouter();
  const needsTime = e.openTimer || e.orphanOff;
  const [clientName, setClientName] = useState(e.client?.name ?? "");
  const [adding, setAdding] = useState(false);
  const typed = clientName.trim().toLowerCase();
  const matched = clients.find((c) => c.name.toLowerCase() === typed)?.id ?? "";
  const [hours, setHours] = useState(String(Math.floor(e.minutes / 60)));
  const [mins, setMins] = useState(String(e.minutes % 60));
  const [newName, setNewName] = useState(e.suggestedClient ?? "");
  const [newInHouse, setNewInHouse] = useState(false);
  const [projectId, setProjectId] = useState(e.projectId ?? "");
  const options = adding ? [] : projects.filter((p) => p.clientId === (matched || null));
  const [when, setWhen] = useState(""); // datetime-local, read as IST
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    const r = await mutate("POST", `/review/entries/${e.id}/${path}`, body);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  async function approve() {
    const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    if (Number(mins) > 59) return setError("Minutes must be 0–59.");
    if (!adding && !matched) return setError(clientName.trim() ? "No client has that name. Pick one from the list, or add it as a new client." : "Choose the client first.");
    let chosen = matched;
    if (adding) {
      if (newName.trim().length < 2) return setError("Type the new client name.");
      setBusy(true);
      setError(null);
      const made = await mutate<{ id: string }>("POST", "/review/clients", { name: newName.trim(), inHouse: newInHouse });
      setBusy(false);
      if (!made.ok) return setError(made.error);
      chosen = made.data.id;
    }
    const body: { minutes?: number; clientId?: string; projectId?: string } = {};
    if (projectId && projectId !== e.projectId && !adding) body.projectId = projectId;
    if (total !== e.minutes) body.minutes = total;
    if (chosen !== e.client?.id) body.clientId = chosen;
    void run("approve", body);
  }

  function resolve() {
    if (!when) return setError(e.openTimer ? "Enter when the timer was switched off." : "Enter when the timer was switched on.");
    const at = `${when}:00${IST}`;
    void run("resolve-timer", e.openTimer ? { endAt: at } : { startAt: at });
  }

  return (
    <li className={SECTION}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-medium">{e.client?.name ?? "Unknown client"}</span>
          <span className="text-zinc-500"> · {e.sender}{e.profile ? ` (${e.profile})` : ""} · {e.entryDate} · {e.source === "TIMER_CALCULATED" ? "timer" : "manual report"}</span>
        </div>
        <div className="text-lg font-semibold">{needsTime ? "Time missing" : fmtMinutes(e.minutes)}</div>
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Why this needs review">
        {e.flags.map((f) => <li key={f} className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs text-status-warning-text">{flagLabel(f)}</li>)}
      </ul>
      {e.reportedOnTimerMinutes !== null && <p className="mt-1 text-xs text-zinc-500">Report says ON-timer {fmtMinutes(e.reportedOnTimerMinutes)}.</p>}
      {!e.client && e.clientRaw && <p className="mt-1 text-xs text-zinc-500">Client written as: {e.clientRaw}</p>}
      {e.memo && <p className="mt-1 text-sm">Memo: {e.memo}</p>}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-zinc-500">Original Chat message</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface-muted p-2 text-xs">{e.messageText}</pre>
      </details>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        {needsTime ? (
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">{e.openTimer ? "Switched off at (IST)" : "Switched on at (IST)"}</span>
            <input type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} className={INPUT} />
          </label>
        ) : (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-500">Client</span>
              <input list="service-review-clients" value={clientName} onChange={(ev) => { setClientName(ev.target.value); setAdding(false); }} placeholder="Type to search" disabled={adding} className={`${INPUT} w-56`} />
            </label>
            <button type="button" onClick={() => setAdding((v) => !v)} className={`${BTN} mb-0.5`}>{adding ? "Pick an existing client" : "+ New client"}</button>
            {adding && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-500">New client name</span>
                  <input value={newName} onChange={(ev) => setNewName(ev.target.value)} maxLength={120} className={`${INPUT} w-56`} />
                </label>
                <label className="flex items-center gap-1 pb-1.5 text-sm"><input type="checkbox" checked={newInHouse} onChange={(ev) => setNewInHouse(ev.target.checked)} /> In-house</label>
              </>
            )}
            {options.length > 1 && (
              <label className="text-sm">
                <span className="mb-1 block text-zinc-500">Project</span>
                <select value={projectId} onChange={(ev) => setProjectId(ev.target.value)} className={`${INPUT} w-48`}>
                  <option value="">Decide later</option>
                  {options.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                </select>
              </label>
            )}
            <fieldset className="text-sm">
              <legend className="mb-1 text-zinc-500">Hours</legend>
              <div className="flex items-center gap-1">
                <input aria-label="Hours" inputMode="numeric" value={hours} onChange={(ev) => setHours(ev.target.value.replace(/\D/g, ""))} className={`${INPUT} w-14`} />
                <span>h</span>
                <input aria-label="Minutes" inputMode="numeric" value={mins} onChange={(ev) => setMins(ev.target.value.replace(/\D/g, ""))} className={`${INPUT} w-14`} />
                <span>m</span>
              </div>
            </fieldset>
          </>
        )}
        {needsTime ? (
          <button disabled={busy} onClick={resolve} className={BTN}>Save time</button>
        ) : (
          <button disabled={busy} onClick={() => void approve()} className={BTN}>{adding ? "Add client and approve" : "Approve"}</button>
        )}
        <button disabled={busy} onClick={() => setRejecting((v) => !v)} className={BTN}>Reject…</button>
      </div>

      {rejecting && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Reason</span>
            <input value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} className={`${INPUT} w-72`} />
          </label>
          <button disabled={busy || !reason.trim()} onClick={() => void run("reject", { reason })} className={BTN}>Confirm reject</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-status-fail-text">{error}</p>}
    </li>
  );
}
