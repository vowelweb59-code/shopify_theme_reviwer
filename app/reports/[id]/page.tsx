"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DiagnosticsNote,
  FindingsTable,
  SummaryBar,
  type AuditDiagnostics,
  type FindingRow,
  type FindingSummary,
} from "@/app/_components/findings";
import { DiffFindingsView, DiffSummaryBar, type FindingsDiffResult } from "@/app/_components/diff";

type AuditRunDetail = {
  _id: string;
  themeId: { _id: string; name: string } | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  summary?: FindingSummary;
  fileStats?: Record<string, number>;
  skippedFileCount?: number;
  diagnostics?: AuditDiagnostics;
  demoStoreUrl?: string | null;
  liveCheckError?: { url: string; error: string } | null;
};

type AuditRunListItem = {
  _id: string;
  themeId: { _id: string; name: string } | null;
  status: string;
  startedAt: string;
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

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [auditRun, setAuditRun] = useState<AuditRunDetail | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [siblingRuns, setSiblingRuns] = useState<AuditRunListItem[]>([]);
  const [baselineId, setBaselineId] = useState("");
  const [diff, setDiff] = useState<FindingsDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/reports/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) {
          setNotFound(true);
        } else {
          setAuditRun(data.auditRun);
          setFindings(data.findings ?? []);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!auditRun?.themeId) return;
    let active = true;
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data) => {
        if (active) setSiblingRuns(data.auditRuns ?? []);
      });
    return () => {
      active = false;
    };
  }, [auditRun?.themeId]);

  const comparableRuns = useMemo(() => {
    if (!auditRun?.themeId) return [];
    const themeId = auditRun.themeId._id;
    return siblingRuns.filter((r) => r._id !== id && r.status === "complete" && r.themeId?._id === themeId);
  }, [siblingRuns, auditRun, id]);

  function runComparison(newBaselineId: string) {
    setBaselineId(newBaselineId);
    setDiff(null);
    setDiffError(null);
    if (!newBaselineId) return;
    setDiffLoading(true);
    fetch(`/api/reports/${id}/diff?baseline=${newBaselineId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setDiffError(data.error);
        else setDiff(data);
        setDiffLoading(false);
      })
      .catch(() => {
        setDiffError("Failed to compute the comparison.");
        setDiffLoading(false);
      });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href="/reports" className="text-sm text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50">
          ← Back to reports
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          {auditRun?.themeId?.name ?? "Audit report"}
        </h1>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {!loading && notFound && <p className="text-sm text-zinc-500">Audit run not found.</p>}

      {!loading && auditRun && (
        <>
          <div className="rounded-md border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
            <div className="flex items-start justify-between gap-4">
              <p>
                Status: <strong>{auditRun.status}</strong>
              </p>
              {auditRun.status === "complete" && (
                <div className="flex gap-3 text-xs">
                  <a
                    href={`/api/reports/${id}/export?format=csv`}
                    className="rounded-full border border-black/[.12] px-3 py-1.5 text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
                  >
                    Export CSV
                  </a>
                  <a
                    href={`/api/reports/${id}/export?format=pdf`}
                    className="rounded-full border border-black/[.12] px-3 py-1.5 text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
                  >
                    Export PDF
                  </a>
                </div>
              )}
            </div>
            <p className="mt-1 text-zinc-500">
              Started {formatDate(auditRun.startedAt)}
              {auditRun.completedAt ? ` — completed ${formatDate(auditRun.completedAt)}` : ""}
            </p>
            {auditRun.error && <p className="mt-2 text-red-700 dark:text-red-300">{auditRun.error}</p>}
            {auditRun.demoStoreUrl && (
              <p className="mt-2 text-zinc-500">
                Live-checked:{" "}
                <a href={auditRun.demoStoreUrl} target="_blank" rel="noreferrer" className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
                  {auditRun.demoStoreUrl}
                </a>
              </p>
            )}
            {auditRun.liveCheckError && (
              <p className="mt-2 text-amber-700 dark:text-amber-400">
                Could not check the live demo store: {auditRun.liveCheckError.error}
              </p>
            )}
          </div>

          {auditRun.summary && <SummaryBar summary={auditRun.summary} />}
          {auditRun.diagnostics && <DiagnosticsNote diagnostics={auditRun.diagnostics} />}
          <FindingsTable findings={findings} />

          {comparableRuns.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-black/[.08] pt-8 dark:border-white/[.145]">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Compare with a previous audit</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  See which findings were resolved, are still present, or are new since an earlier run of this theme.
                </p>
              </div>
              <select
                value={baselineId}
                onChange={(e) => runComparison(e.target.value)}
                className="w-fit rounded-md border border-black/[.12] bg-transparent px-3 py-2 text-sm dark:border-white/[.15]"
              >
                <option value="">Select a previous audit…</option>
                {comparableRuns.map((r) => (
                  <option key={r._id} value={r._id}>
                    {formatDate(r.startedAt)}
                  </option>
                ))}
              </select>

              {diffLoading && <p className="text-sm text-zinc-500">Comparing…</p>}
              {diffError && <p className="text-sm text-red-700 dark:text-red-300">{diffError}</p>}
              {diff && (
                <>
                  <DiffSummaryBar summary={diff.summary} />
                  <DiffFindingsView findings={diff.findings} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
