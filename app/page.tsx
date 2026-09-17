"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "./_components/shell/PageContainer";
import { Card } from "./_components/ui/Card";
import { ResponsiveTable, type TableColumn } from "./_components/ui/Table";
import { EmptyState } from "./_components/ui/EmptyState";
import { LayoutDashboard } from "lucide-react";

type DashboardData = {
  themeCount: number;
  totalAudits: number;
  openIssueCount: number;
  overallHealthPercent: number | null;
  totals: { passed: number; failed: number; warnings: number; total: number };
  recentAudits: { auditRunId: string; themeName: string; version: string | null; startedAt: string; passed: number; total: number }[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function healthTone(percent: number) {
  if (percent >= 90) return "text-status-pass-text";
  if (percent >= 70) return "text-status-warning-text";
  return "text-status-fail-text";
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const columns: TableColumn<DashboardData["recentAudits"][number]>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => (
        <Link href={`/reports/${r.auditRunId}`} className="font-medium text-zinc-950 hover:text-primary hover:underline dark:text-zinc-50">
          {r.themeName}
        </Link>
      ),
      sortValue: (r) => r.themeName,
    },
    { key: "version", header: "Version", render: (r) => <span className="font-mono text-xs text-zinc-500">{r.version ?? "—"}</span> },
    { key: "date", header: "Date", render: (r) => formatDate(r.startedAt), sortValue: (r) => r.startedAt },
    {
      key: "result",
      header: "Result",
      render: (r) => (
        <span className={r.total > 0 ? healthTone(Math.round((r.passed / r.total) * 100)) : ""}>
          {r.passed} / {r.total}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">An overview of every theme you maintain and their audit health.</p>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && data && data.themeCount === 0 && (
        <EmptyState
          icon={LayoutDashboard}
          title="No themes yet"
          description="Add your first Shopify theme to start running automated audits."
          action={
            <Link href="/themes" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]">
              + Add Theme
            </Link>
          }
        />
      )}

      {!loading && data && data.themeCount > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{data.themeCount}</div>
              <div className="text-sm text-zinc-500">Themes</div>
            </Card>
            <Card>
              <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{data.totalAudits}</div>
              <div className="text-sm text-zinc-500">Total audits</div>
            </Card>
            <Card>
              <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{data.openIssueCount}</div>
              <div className="text-sm text-zinc-500">Open issues</div>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">Audit health</h2>
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <div className={`text-4xl font-semibold ${data.overallHealthPercent !== null ? healthTone(data.overallHealthPercent) : "text-zinc-400"}`}>
                  {data.overallHealthPercent !== null ? `${data.overallHealthPercent}%` : "—"}
                </div>
                <div className="text-sm text-zinc-500">Overall</div>
              </div>
              <div className="flex gap-8 text-sm">
                <div>
                  <div className="text-xl font-semibold text-status-pass-text">{data.totals.passed}</div>
                  <div className="text-zinc-500">Passed</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-status-fail-text">{data.totals.failed}</div>
                  <div className="text-zinc-500">Failed</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-status-warning-text">{data.totals.warnings}</div>
                  <div className="text-zinc-500">Warnings</div>
                </div>
              </div>
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-base font-semibold text-zinc-950 dark:text-zinc-50">Recent audits</h2>
            <ResponsiveTable
              columns={columns}
              rows={data.recentAudits}
              rowKey={(r) => r.auditRunId}
              emptyMessage="No audits yet."
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
