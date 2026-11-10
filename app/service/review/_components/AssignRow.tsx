"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";
import { fmtMinutes, INPUT } from "@/lib/service/ui/format";
import type { ReviewEntry, ReviewProject } from "@/lib/service/api/review";
import { BTN, SECTION } from "./shared";

/** An entry of a client with several projects: the reviewer says which project it counts toward. */
export function AssignRow({ entry: e, projects }: { entry: ReviewEntry; projects: ReviewProject[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    setBusy(true);
    setError(null);
    const r = await mutate("POST", `/review/entries/${e.id}/assign-project`, { projectId });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 ${SECTION}`}>
      <div className="min-w-48 flex-1">
        <span className="font-medium">{e.client?.name}</span>
        <span className="text-zinc-500"> · {e.sender} · {e.entryDate}</span>
        {e.memo && <div className="text-sm text-zinc-500">{e.memo}</div>}
      </div>
      <div className="font-semibold">{fmtMinutes(e.minutes)}</div>
      <select aria-label="Project" value={projectId} onChange={(ev) => setProjectId(ev.target.value)} className={INPUT}>
        <option value="">Choose a project…</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
      </select>
      <button disabled={busy || !projectId} onClick={() => void assign()} className={BTN}>Assign</button>
      {error && <p role="alert" className="basis-full text-sm text-status-fail-text">{error}</p>}
    </li>
  );
}
