"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PageSpeedMetric } from "@/lib/audit/pageSpeed";

type ThemePageSpeedRow = {
  themeId: string;
  themeName: string;
  runId: string;
  startedAt: string;
  pageSpeed: PageSpeedMetric[];
  openPerformanceFindingCount: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatScore(metrics: PageSpeedMetric[]): string {
  const scored = metrics.filter((m) => typeof m.performanceScore === "number");
  if (scored.length === 0) return "—";
  return scored.map((m) => `${m.label}: ${m.performanceScore}/100`).join(", ");
}

export function PageSpeedContent() {
  const [rows, setRows] = useState<ThemePageSpeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/page-speed")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setRows(data.themes ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Page Speed</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Each theme&apos;s latest completed audit — Lighthouse performance score (via Google&apos;s PageSpeed
          Insights API, falling back to Playwright-based timing heuristics when unavailable) and open Performance
          findings. Runs with no demo store URL supplied have no page-speed data.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Theme</th>
              <th className="px-4 py-3 font-medium">Latest audit</th>
              <th className="px-4 py-3 font-medium">Performance score</th>
              <th className="px-4 py-3 font-medium">Open findings</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={4}>
                  No audits with a demo URL yet — add one from the Audit page.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.themeId} className="border-b border-black/[.06] last:border-0 dark:border-white/[.08]">
                <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                  <Link href={`/reports/${row.runId}`} className="underline hover:no-underline">
                    {row.themeName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatDate(row.startedAt)}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {row.pageSpeed.length > 0 ? formatScore(row.pageSpeed) : "No page-speed data"}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.openPerformanceFindingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
