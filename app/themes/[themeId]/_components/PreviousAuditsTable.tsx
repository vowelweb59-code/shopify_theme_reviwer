"use client";

import Link from "next/link";

type PreviousAuditRow = {
  auditRunId: string;
  version: string | null;
  startedAt: string;
  totals: { total: number; passed: number; failed: number; warnings: number; notTested: number };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PreviousAuditsTable({ audits }: { audits: PreviousAuditRow[] }) {
  if (audits.length === 0) {
    return <p className="text-sm text-zinc-500">No completed audits yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Version</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Checks</th>
            <th className="px-4 py-3 font-medium">Passed</th>
            <th className="px-4 py-3 font-medium">Failed</th>
            <th className="px-4 py-3 font-medium">Warnings</th>
          </tr>
        </thead>
        <tbody>
          {audits.map((a) => (
            <tr key={a.auditRunId} className="border-b border-black/[.06] last:border-0 dark:border-white/[.08]">
              <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                <Link href={`/reports/${a.auditRunId}`} className="underline hover:no-underline">
                  {a.version ?? "—"}
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatDate(a.startedAt)}</td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{a.totals.total}</td>
              <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400">{a.totals.passed}</td>
              <td className="px-4 py-3 text-red-700 dark:text-red-400">{a.totals.failed}</td>
              <td className="px-4 py-3 text-amber-700 dark:text-amber-400">{a.totals.warnings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
