"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutate } from "@/lib/service/ui/client";

type Plan = {
  closedWithoutReview: number;
  postsRead: number;
  fill: Array<{ projectId: string; name: string; rating: number; endedOn: string }>;
  noRating: string[];
  skipped: Array<{ name: string; why: string }>;
  noPost: string[];
  applied: string[];
};

/** Closed view: finds the closing review of projects that have none in the "Contract ended" posts of New Project Update, then saves the ones you confirm. */
export function FillReviews() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await mutate<Plan>("POST", "/projects/fill-reviews", { apply: false });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setPlan(r.data);
  }

  async function save() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    const r = await mutate<Plan>("POST", "/projects/fill-reviews", { apply: true, ids: plan.fill.map((c) => c.projectId) });
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
        <button type="button" onClick={check} disabled={busy} className={btn}>
          {busy && !plan ? "Reading the space…" : "Find missing reviews in New Project Update"}
        </button>
        <span className="text-xs text-zinc-500">
          Reads every “Contract ended … with N-star ratings” post, lists the reviews it finds for closed projects with none, and saves them only when you
          confirm.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-status-fail-text">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-status-pass-text">
          Saved {done.length} review{done.length === 1 ? "" : "s"}.
        </p>
      )}
      {plan && (
        <div className="space-y-3">
          <p className="text-zinc-600 dark:text-zinc-400">
            {plan.postsRead.toLocaleString()} posts read. Of {plan.closedWithoutReview} closed projects with no review: <strong>{plan.fill.length}</strong> have
            one there, {plan.noRating.length} have an ended post with no star rating, {plan.skipped.length} need a person, {plan.noPost.length} have no ended
            post.
          </p>
          {plan.fill.length > 0 && (
            <>
              <ul className="max-h-72 overflow-auto rounded-md border border-border-subtle">
                {plan.fill.map((c) => (
                  <li key={c.projectId} className="flex justify-between gap-4 border-b border-border-subtle px-3 py-1.5 last:border-b-0">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-zinc-500">
                      {c.rating}★ · ended {c.endedOn.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={save} disabled={busy} className={`${btn} border-primary font-medium text-primary-tint-text`}>
                {busy ? "Saving…" : `Save these ${plan.fill.length} reviews`}
              </button>
            </>
          )}
          {plan.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-zinc-500">{plan.skipped.length} left for a person</summary>
              <ul className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                {plan.skipped.map((s) => (
                  <li key={s.name}>
                    <span className="font-medium">{s.name}</span>: {s.why}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {plan.noRating.length > 0 && (
            <details>
              <summary className="cursor-pointer text-zinc-500">{plan.noRating.length} ended with no star rating in the post</summary>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{plan.noRating.join(", ")}</p>
            </details>
          )}
          {plan.noPost.length > 0 && (
            <details>
              <summary className="cursor-pointer text-zinc-500">{plan.noPost.length} with no ended post</summary>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{plan.noPost.join(", ")}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
