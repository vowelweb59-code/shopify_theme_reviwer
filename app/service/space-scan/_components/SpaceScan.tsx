"use client";

import { useEffect, useState } from "react";
import { PRIORITIES, TASK_GROUPS, type SpaceReview } from "@/lib/service/import/space-review";
import { mutate } from "@/lib/service/ui/client";

type Item = { id: string; sender: string; postedAt: string; text: string; reason: string };
type Result = {
  space: string;
  scannedAt: string;
  scanned: number;
  from: string | null;
  to: string | null;
  tasks: Item[];
  doneTasks: number;
  opportunities: Item[];
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const age = (iso: string) => Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 86_400_000));
const btn = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-50";
const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary text-primary" : "border-border-subtle text-zinc-500 hover:bg-surface-muted"}`;
const PRIORITY_TONE: Record<string, string> = {
  High: "bg-status-pass-bg text-status-pass-text",
  Medium: "bg-status-warning-bg text-status-warning-text",
  Low: "bg-surface-muted text-zinc-500",
};

/** Temporary tab: pending tasks and pitch opportunities of one Chat space. The reviewed lists (read by Claude Code, loaded into the database) come first; the wording scan is a rougher second view. */
export function SpaceScan({ review }: { review: SpaceReview | null }) {
  const [tab, setTab] = useState<"tasks" | "opportunities">("tasks");
  const [group, setGroup] = useState("all");
  const [priority, setPriority] = useState("all");

  const tasks = review ? (group === "all" ? review.tasks : review.tasks.filter((t) => t.group === group)) : [];
  const opps = review ? (priority === "all" ? review.opportunities : review.opportunities.filter((o) => o.priority === priority)) : [];

  return (
    <div className="space-y-4">
      {review ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {review.client ?? "This space"}, read in full by Claude Code on {fmt(review.reviewedAt)}
          {review.source ? ` (${review.source})` : ""}. {review.tasks.length} pending tasks, {review.opportunities.length} opportunities. “Pending” is judged
          from Chat only: work done in ClickUp, email or on the store does not show.
        </p>
      ) : (
        <p className="rounded-lg border border-border-subtle bg-surface p-4 text-sm text-zinc-600 dark:text-zinc-400">
          No reviewed list is loaded yet. Download the space below, have Claude Code read it, then load the result with{" "}
          <code>scripts/import-space-review.ts</code>. The automatic wording scan at the bottom works meanwhile.
        </p>
      )}

      <div role="tablist" className="flex gap-1 border-b border-border-subtle">
        {(
          [
            ["tasks", `Pending tasks${review ? ` (${review.tasks.length})` : ""}`],
            ["opportunities", `Opportunities to pitch${review ? ` (${review.opportunities.length})` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {review && tab === "tasks" && (
        <>
          <div className="flex flex-wrap gap-2">
            {[{ id: "all", label: "All" }, ...TASK_GROUPS].map((g) => (
              <button key={g.id} type="button" onClick={() => setGroup(g.id)} className={chip(group === g.id)}>
                {g.label}
                {g.id !== "all" ? ` (${review.tasks.filter((t) => t.group === g.id).length})` : ""}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface text-sm">
            {tasks.map((t, i) => (
              <li key={i} className="space-y-1 px-4 py-3">
                <p className="font-medium">{t.text}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                  {t.who && <span>Who: {t.who}</span>}
                  {t.asked && <span>Asked: {t.asked}</span>}
                  {t.threads && <span>Threads: {t.threads}</span>}
                  <span className="rounded-full bg-surface-muted px-2 py-0.5">{TASK_GROUPS.find((g) => g.id === t.group)?.label}</span>
                </div>
                {t.evidence && <p className="text-xs text-zinc-600 dark:text-zinc-400">Why it looks open: {t.evidence}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {review && tab === "opportunities" && (
        <>
          <div className="flex flex-wrap gap-2">
            {["all", ...PRIORITIES].map((p) => (
              <button key={p} type="button" onClick={() => setPriority(p)} className={chip(priority === p)}>
                {p === "all" ? "All" : p}
                {p !== "all" ? ` (${review.opportunities.filter((o) => o.priority === p).length})` : ""}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface text-sm">
            {opps.map((o, i) => (
              <li key={i} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_TONE[o.priority]}`}>{o.priority}</span>
                  <p className="font-medium">{o.title}</p>
                </div>
                {o.pitch && <p>Pitch: {o.pitch}</p>}
                {o.evidence && <p className="text-xs text-zinc-500">Seen in: {o.evidence}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {review && review.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
          {review.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      <WordingScan tab={tab} />
    </div>
  );
}

/** The rougher second view: messages worded like a task or a sales opening (no thread information), read live from the space on the server. */
function WordingScan({ tab }: { tab: "tasks" | "opportunities" }) {
  const [result, setResult] = useState<Result | null>(null);
  const [reason, setReason] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/service/space-scan")
      .then((r) => r.json())
      .then((d: { result?: Result | null }) => setResult(d.result ?? null))
      .catch(() => undefined);
  }, []);

  async function scan() {
    setBusy(true);
    setError(null);
    const r = await mutate<{ result: Result }>("POST", "/space-scan");
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data.result);
    setReason("all");
  }

  const items = result ? (tab === "tasks" ? result.tasks : result.opportunities) : [];
  const reasons = [...new Set(items.map((i) => i.reason))];
  const shown = reason === "all" ? items : items.filter((i) => i.reason === reason);

  return (
    <details className="rounded-lg border border-border-subtle bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-medium">Automatic wording scan and full download</summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={scan} disabled={busy} className={btn}>
            {busy ? "Reading the whole space…" : result ? "Scan again" : "Scan the space"}
          </button>
          <a href="/api/service/space-scan/export" download className={btn}>
            Download the whole space (threaded .txt)
          </a>
          <span className="text-xs text-zinc-500">
            The scan picks messages worded like a task or a sales opening (a guess, no threads). The download is what Claude Code reads to make the lists above.
          </span>
        </div>
        {error && (
          <p role="alert" className="text-status-fail-text">
            {error}
          </p>
        )}
        {result && (
          <>
            <p className="text-xs text-zinc-500">
              {result.scanned.toLocaleString()} messages read, scanned {fmt(result.scannedAt)}. {result.tasks.length} possible tasks ({result.doneTasks} more
              look done), {result.opportunities.length} possible opportunities; newest 500 shown.
            </p>
            <div className="flex flex-wrap gap-2">
              {["all", ...reasons].map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className={chip(reason === r)}>
                  {r === "all" ? "All" : r}
                </button>
              ))}
            </div>
            <ul className="max-h-96 divide-y divide-border-subtle overflow-auto rounded-md border border-border-subtle">
              {shown.map((i) => (
                <li key={i.id} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{i.sender}</span>
                    <span>{fmt(i.postedAt)}</span>
                    {tab === "tasks" && <span>{age(i.postedAt)} days ago</span>}
                    <span className="rounded-full bg-surface-muted px-2 py-0.5">{i.reason}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{i.text}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
