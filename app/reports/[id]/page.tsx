"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  DiagnosticsNote,
  FindingsTable,
  SummaryBar,
  type AuditDiagnostics,
  type FindingRow,
  type FindingSummary,
} from "@/app/_components/findings";

type AuditRunDetail = {
  _id: string;
  themeId: { name: string } | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  summary?: FindingSummary;
  fileStats?: Record<string, number>;
  skippedFileCount?: number;
  diagnostics?: AuditDiagnostics;
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
            <p>
              Status: <strong>{auditRun.status}</strong>
            </p>
            <p className="mt-1 text-zinc-500">
              Started {formatDate(auditRun.startedAt)}
              {auditRun.completedAt ? ` — completed ${formatDate(auditRun.completedAt)}` : ""}
            </p>
            {auditRun.error && <p className="mt-2 text-red-700 dark:text-red-300">{auditRun.error}</p>}
          </div>

          {auditRun.summary && <SummaryBar summary={auditRun.summary} />}
          {auditRun.diagnostics && <DiagnosticsNote diagnostics={auditRun.diagnostics} />}
          <FindingsTable findings={findings} />
        </>
      )}
    </div>
  );
}
