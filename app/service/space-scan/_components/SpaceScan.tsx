"use client";

import { useEffect, useState } from "react";
import { mutate } from "@/lib/service/ui/client";

type Item = {
  id: string;
  sender: string;
  postedAt: string;
  text: string;
  reason: string;
};
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

/** Temporary tab: reads one whole Chat space and lists its pending tasks and pitch opportunities (rule-based; candidates for a person to read). */
export function SpaceScan() {
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"tasks" | "opportunities">("tasks");
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
  const btn = "rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={scan} disabled={busy} className={`${btn} border-primary font-medium text-primary-tint-text`}>
          {busy ? "Reading the whole space…" : result ? "Scan again" : "Scan the space"}
        </button>
        <a href="/api/service/space-scan/export" download className={btn}>
          Download the whole space (threaded .txt)
        </a>
        <span className="text-xs text-zinc-500">
          Temporary. Scan picks messages worded like a task or a sales opening (a guess, can take a minute). Download gives the full conversation grouped by
          thread, to be read by Claude Code, which judges what is really pending. Nothing is saved.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-status-fail-text">
          {error}
        </p>
      )}
      {result && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {result.scanned.toLocaleString()} messages read ({result.from ? fmt(result.from) : "-"} to {result.to ? fmt(result.to) : "-"}), scanned{" "}
          {fmt(result.scannedAt)}. {result.tasks.length} possible pending tasks ({result.doneTasks} more look done: a later message in the same week says so),{" "}
          {result.opportunities.length} possible opportunities. Lists show the newest 500.
        </p>
      )}
      {result && (
        <>
          <div role="tablist" className="flex gap-1 border-b border-border-subtle">
            {(
              [
                ["tasks", `Pending tasks (${result.tasks.length})`],
                ["opportunities", `Opportunities to pitch (${result.opportunities.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  setReason("all");
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {["all", ...reasons].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-2.5 py-1 ${reason === r ? "border-primary text-primary" : "border-border-subtle text-zinc-500 hover:bg-surface-muted"}`}
              >
                {r === "all" ? "All" : r}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing found.</p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface text-sm">
              {shown.map((i) => (
                <li key={i.id} className="space-y-1 px-4 py-3">
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
          )}
        </>
      )}
    </div>
  );
}
