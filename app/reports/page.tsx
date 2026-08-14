"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuditRunRow = {
  _id: string;
  themeId: { name: string } | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
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

export default function ReportsPage() {
  const [auditRuns, setAuditRuns] = useState<AuditRunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setAuditRuns(data.auditRuns ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Reports</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Audit run history. Open a run to see its findings and severity summary, export to CSV/PDF, or compare it
          against a previous audit of the same theme.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Theme</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={5}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && auditRuns.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={5}>
                  No audit runs yet — start one from the Audit page.
                </td>
              </tr>
            )}
            {auditRuns.map((run) => (
              <tr key={run._id} className="border-b border-black/[.06] last:border-0 dark:border-white/[.08]">
                <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                  <Link href={`/reports/${run._id}`} className="underline hover:no-underline">
                    {run.themeId?.name ?? "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{run.status}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatDate(run.startedAt)}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {run.completedAt ? formatDate(run.completedAt) : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500">{run.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
