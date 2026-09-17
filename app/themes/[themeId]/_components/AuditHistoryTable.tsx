"use client";

import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";

type AuditHistoryRow = {
  auditRunId: string;
  version: string | null;
  startedAt: string;
  totals: { total: number; passed: number; failed: number; warnings: number; notTested: number };
};

type Row = AuditHistoryRow & { isLatest: boolean };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Every audit run across every version, newest first. Clicking a row shows
 * that run's full report inline in this page's Report section (onSelect)
 * rather than navigating to the standalone /reports/[id] page — that page
 * still exists (e.g. for legacy pre-Themes-module audits), it's just no
 * longer the primary way to view a report from here.
 */
export function AuditHistoryTable({ audits, onSelect }: { audits: AuditHistoryRow[]; onSelect: (auditRunId: string) => void }) {
  // "Latest" only makes sense relative to the original newest-first order —
  // computed once here, before the table's own column sort can reorder rows.
  const rows: Row[] = audits.map((a, i) => ({ ...a, isLatest: i === 0 }));

  const columns: TableColumn<Row>[] = [
    {
      key: "version",
      header: "Version",
      render: (a) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{a.version ?? "—"}</span>
          {a.isLatest && (
            <span className="rounded-full bg-status-info-bg px-1.5 py-0.5 text-[10px] font-medium uppercase text-status-info-text">Latest</span>
          )}
        </span>
      ),
    },
    { key: "date", header: "Date", render: (a) => formatDate(a.startedAt), sortValue: (a) => a.startedAt },
    { key: "checks", header: "Checks", render: (a) => a.totals.total },
    { key: "passed", header: "Passed", render: (a) => <span className="text-status-pass-text">{a.totals.passed}</span> },
    { key: "failed", header: "Failed", render: (a) => <span className="text-status-fail-text">{a.totals.failed}</span> },
    { key: "warnings", header: "Warnings", render: (a) => <span className="text-status-warning-text">{a.totals.warnings}</span> },
  ];

  return (
    <ResponsiveTable columns={columns} rows={rows} rowKey={(a) => a.auditRunId} onRowClick={(a) => onSelect(a.auditRunId)} emptyMessage="No completed audits yet." />
  );
}
