"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ServiceProjectStatus } from "@/models/service-shared";
import { mutate } from "@/lib/service/ui/client";
import { NEXT_STATUSES, statusLabel } from "@/lib/service/ui/format";

type Dept = "AUTO" | "STAY" | "MOVED";

// Changes a project's status to any other status, and where the overview places it (owner, 2026-11-21: "an option to change the status to
// any status or sub status"). The placement is the "sub status": automatic (the 30-day rule), kept with the team, or moved to another department.
export function StatusControl({ projectId, status, deptOverride }: { projectId: string; status: ServiceProjectStatus; deptOverride: "STAY" | "MOVED" | null }) {
  const router = useRouter();
  const options = NEXT_STATUSES[status];
  const current: Dept = deptOverride ?? "AUTO";
  const [to, setTo] = useState<ServiceProjectStatus | "">("");
  const [dept, setDept] = useState<Dept>(current);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placementChanged = dept !== current;
  const reopening = status === "COMPLETED" && to === "ACTIVE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to && !placementChanged) return;
    setBusy(true);
    setError(null);
    const r = await mutate("POST", `/projects/${projectId}/status`, {
      ...(to ? { to } : {}),
      ...(placementChanged ? { dept } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setTo("");
    setReason("");
    router.refresh();
  }

  const input = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Change status (now {statusLabel(status)})</span>
        <select value={to} onChange={(e) => setTo(e.target.value as ServiceProjectStatus | "")} className={input}>
          <option value="">Keep {statusLabel(status)}</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Where it sits in the overview</span>
        <select value={dept} onChange={(e) => setDept(e.target.value as Dept)} className={input}>
          <option value="AUTO">Automatic (another department after 30 days without a team report)</option>
          <option value="STAY">Keep with my team</option>
          <option value="MOVED">Moved to another department</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Reason{reopening ? " (required)" : " (optional)"}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required={reopening} className={`${input} w-64`} />
      </label>
      <button
        disabled={(!to && !placementChanged) || busy}
        className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60"
      >
        {busy ? "Saving…" : "Apply"}
      </button>
      {error && (
        <p role="alert" className="basis-full text-sm text-status-fail-text">
          {error}
        </p>
      )}
    </form>
  );
}
