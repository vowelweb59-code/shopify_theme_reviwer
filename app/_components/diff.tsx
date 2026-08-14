"use client";

import { useState } from "react";
import { SeverityBadge } from "./findings";

export type DiffFindingDetail = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  layer?: "static" | "live";
  finding: string;
  recommendation?: string | null;
};

export type DiffFindingRow = {
  status: "resolved" | "still_present" | "new" | "changed";
  previous?: DiffFindingDetail;
  current?: DiffFindingDetail;
};

export type FindingsDiffResult = {
  summary: {
    previousTotal: number;
    currentTotal: number;
    resolved: number;
    stillPresent: number;
    new: number;
    changed: number;
  };
  findings: DiffFindingRow[];
};

const STATUS_LABEL: Record<DiffFindingRow["status"], string> = {
  resolved: "Resolved",
  still_present: "Still present",
  new: "New",
  changed: "Changed",
};

const STATUS_STYLES: Record<DiffFindingRow["status"], string> = {
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  still_present: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  new: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  changed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export function DiffSummaryBar({ summary }: { summary: FindingsDiffResult["summary"] }) {
  return (
    <div className="flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
      <div>
        <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          {summary.previousTotal} → {summary.currentTotal}
        </div>
        <div className="text-zinc-500">Findings</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{summary.resolved}</div>
        <div className="text-zinc-500">Resolved</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-zinc-700 dark:text-zinc-300">{summary.stillPresent}</div>
        <div className="text-zinc-500">Still present</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{summary.new}</div>
        <div className="text-zinc-500">New</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{summary.changed}</div>
        <div className="text-zinc-500">Changed</div>
      </div>
    </div>
  );
}

const TABS = ["all", "resolved", "still_present", "new", "changed"] as const;
type Tab = (typeof TABS)[number];

export function DiffFindingsView({ findings }: { findings: DiffFindingRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const visible = tab === "all" ? findings : findings.filter((f) => f.status === tab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 ${
              tab === t
                ? "bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                : "border border-black/[.12] text-zinc-600 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            {t === "all" ? "All" : STATUS_LABEL[t]} ({t === "all" ? findings.length : findings.filter((f) => f.status === t).length})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing in this category.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Finding</th>
                <th className="px-4 py-3 font-medium">Rule</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => {
                const shown = row.current ?? row.previous!;
                return (
                  <tr key={i} className="border-b border-black/[.06] align-top last:border-0 dark:border-white/[.08]">
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={shown.severity} />
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{shown.category}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {shown.filePath}
                      {shown.lineNumber ? `:${shown.lineNumber}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "changed" && row.previous ? (
                        <div className="flex flex-col gap-1">
                          <div className="text-zinc-500 line-through">{row.previous.finding}</div>
                          <div className="text-zinc-950 dark:text-zinc-50">{row.current?.finding}</div>
                        </div>
                      ) : (
                        <div className="text-zinc-950 dark:text-zinc-50">{shown.finding}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{shown.ruleId}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
