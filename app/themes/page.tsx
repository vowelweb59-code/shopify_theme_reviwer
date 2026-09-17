"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Palette } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { AddThemeModal } from "./_components/AddThemeModal";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type ThemeRow = {
  theme: { _id: string; name: string };
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checkTotals: CheckTotals | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function healthPercent(totals: CheckTotals | null): number | null {
  if (!totals || totals.total === 0) return null;
  return Math.round((totals.passed / totals.total) * 100);
}

function healthTone(percent: number) {
  if (percent >= 90) return "text-status-pass-text";
  if (percent >= 70) return "text-status-warning-text";
  return "text-status-fail-text";
}

export default function ThemesPage() {
  const [rows, setRows] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    fetch("/api/themes")
      .then((res) => res.json())
      .then((data) => {
        setRows(data.themes ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const columns: TableColumn<ThemeRow>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => (
        <Link href={`/themes/${r.theme._id}`} className="font-medium text-zinc-950 hover:underline dark:text-zinc-50">
          {r.theme.name}
        </Link>
      ),
      sortValue: (r) => r.theme.name,
    },
    {
      key: "version",
      header: "Current Version",
      render: (r) => (r.latestVersion ? <span className="font-mono text-xs">{r.latestVersion.version}</span> : <span className="text-zinc-400">—</span>),
    },
    {
      key: "latestAudit",
      header: "Latest Audit",
      render: (r) => (r.latestAudit ? formatDate(r.latestAudit.startedAt) : <span className="text-zinc-400">—</span>),
      sortValue: (r) => r.latestAudit?.startedAt ?? "",
    },
    {
      key: "health",
      header: "Health",
      render: (r) => {
        const pct = healthPercent(r.checkTotals);
        return pct === null ? <span className="text-zinc-400">—</span> : <span className={`font-semibold ${healthTone(pct)}`}>{pct}%</span>;
      },
      sortValue: (r) => healthPercent(r.checkTotals) ?? -1,
    },
    {
      key: "results",
      header: "Passed / Failed / Warnings",
      render: (r) =>
        r.checkTotals ? (
          <span className="text-xs">
            <span className="text-status-pass-text">{r.checkTotals.passed}</span>
            {" / "}
            <span className="text-status-fail-text">{r.checkTotals.failed}</span>
            {" / "}
            <span className="text-status-warning-text">{r.checkTotals.warnings}</span>
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <Link
          href={`/themes/${r.theme._id}`}
          className="rounded-full border border-border-subtle px-3 py-1.5 text-xs text-zinc-700 hover:border-border-strong hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Open Theme
        </Link>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Themes</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage theme versions and audit history.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add Theme
        </Button>
      </div>

      <AddThemeModal open={modalOpen} onOpenChange={setModalOpen} onCreated={load} />

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon={Palette}
          title="No themes yet"
          description="Upload your first Shopify theme to start running automated audits."
          action={<Button onClick={() => setModalOpen(true)}>+ Add Theme</Button>}
        />
      )}

      {!loading && rows.length > 0 && <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.theme._id} />}
    </PageContainer>
  );
}
