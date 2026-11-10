"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ServiceProjectStatus } from "@/models/service-shared";
import { mutate } from "@/lib/service/ui/client";
import { NEXT_STATUSES, statusLabel } from "@/lib/service/ui/format";

export function StatusControl({ projectId, status }: { projectId: string; status: ServiceProjectStatus }) {
  const router = useRouter();
  const options = NEXT_STATUSES[status];
  const [to, setTo] = useState<ServiceProjectStatus | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) return <p className="text-sm text-zinc-500">Archived projects cannot change status.</p>;

  const reopening = status === "COMPLETED" && to === "ACTIVE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to) return;
    setBusy(true);
    setError(null);
    const r = await mutate("POST", `/projects/${projectId}/status`, { to, ...(reason.trim() ? { reason: reason.trim() } : {}) });
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
        <span className="mb-1 block text-zinc-500">Change status</span>
        <select value={to} onChange={(e) => setTo(e.target.value as ServiceProjectStatus | "")} className={input}>
          <option value="">Move to…</option>
          {options.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Reason{reopening ? " (required)" : " (optional)"}</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required={reopening} className={`${input} w-64`} />
      </label>
      <button disabled={!to || busy} className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-60">
        {busy ? "Saving…" : "Apply"}
      </button>
      {error && <p role="alert" className="basis-full text-sm text-status-fail-text">{error}</p>}
    </form>
  );
}
