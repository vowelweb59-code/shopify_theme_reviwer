"use client";

type PreviousAuditRow = {
  auditRunId: string;
  version: string | null;
  startedAt: string;
  totals: { total: number; passed: number; failed: number; warnings: number; notTested: number };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Clicking a row shows that run's full report inline in this page's Report
 * section (onSelect) rather than navigating to the standalone /reports/[id]
 * page — that page still exists (e.g. for legacy pre-Themes-module audits),
 * it's just no longer the primary way to view a report from here.
 */
export function PreviousAuditsTable({ audits, onSelect }: { audits: PreviousAuditRow[]; onSelect: (auditRunId: string) => void }) {
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
            <tr
              key={a.auditRunId}
              onClick={() => onSelect(a.auditRunId)}
              className="cursor-pointer border-b border-black/[.06] last:border-0 hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]"
            >
              <td className="px-4 py-3 font-medium text-zinc-950 underline hover:no-underline dark:text-zinc-50">{a.version ?? "—"}</td>
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
