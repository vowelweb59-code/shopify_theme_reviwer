"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";

type Plan = {
  heldCount: number;
  postsRead: number;
  close: Array<{ projectId: string; name: string; endedOn: string; rating: number | null }>;
  skipped: Array<{ name: string; why: string }>;
  noPost: string[];
  applied: string[];
};

/** On hold view: checks every held project against the "Contract ended" posts of New Project Update, then completes the ones you confirm. */
export function CloseFromPosts() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await mutate<Plan>("POST", "/projects/close-from-posts", { apply: false });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setPlan(r.data);
  }

  async function complete() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    const r = await mutate<Plan>("POST", "/projects/close-from-posts", { apply: true, ids: plan.close.map((c) => c.projectId) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(r.data.applied);
    setPlan(null);
    router.refresh();
  }

  const btn = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-50";
  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={check} disabled={busy} className={btn}>{busy && !plan ? "Reading the space…" : "Check against New Project Update"}</button>
        <span className="text-xs text-zinc-500">Reads every “Contract ended” post, shows which held projects it closes, and completes them only when you confirm.</span>
      </div>
      {error && <p role="alert" className="text-status-fail-text">{error}</p>}
      {done && <p role="status" className="text-status-pass-text">Completed {done.length} project{done.length === 1 ? "" : "s"}{done.length ? `: ${done.join(", ")}` : ""}.</p>}
      {plan && (
        <div className="space-y-3">
          <p className="text-zinc-600 dark:text-zinc-400">{plan.postsRead.toLocaleString()} posts read. Of {plan.heldCount} held projects: <strong>{plan.close.length}</strong> ended there, {plan.skipped.length} need a person, {plan.noPost.length} have no ended post.</p>
          {plan.close.length > 0 && (
            <>
              <ul className="max-h-72 overflow-auto rounded-md border border-border-subtle">
                {plan.close.map((c) => (
                  <li key={c.projectId} className="flex justify-between gap-4 border-b border-border-subtle px-3 py-1.5 last:border-b-0">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-zinc-500">ended {c.endedOn.slice(0, 10)}{c.rating != null ? ` · ${c.rating}★` : ""}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={complete} disabled={busy} className={`${btn} border-primary font-medium text-primary-tint-text`}>{busy ? "Completing…" : `Complete these ${plan.close.length} projects`}</button>
            </>
          )}
          {plan.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-zinc-500">{plan.skipped.length} left for a person</summary>
              <ul className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">{plan.skipped.map((s) => <li key={s.name}><span className="font-medium">{s.name}</span>: {s.why}</li>)}</ul>
            </details>
          )}
          {plan.noPost.length > 0 && (
            <details>
              <summary className="cursor-pointer text-zinc-500">{plan.noPost.length} with no ended post (stay on hold)</summary>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{plan.noPost.join(", ")}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
