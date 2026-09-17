"use client";

import { useCallback, useEffect, useState } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { ReportContent } from "@/app/reports/ReportContent";
import type { CategoryChecks } from "@/lib/themes/deriveChecksForAuditRun";
import type { DemoStorePreset } from "@/app/_components/PresetLinksEditor";
import { OverviewPanel } from "./OverviewPanel";
import { AllChecksList } from "./AllChecksList";
import { PreviousAuditsTable } from "./PreviousAuditsTable";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type ThemeDetail = {
  theme: { _id: string; name: string; demoStorePresets?: DemoStorePreset[] };
  versions: { _id: string; version: string }[];
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checks: { categories: CategoryChecks[]; totals: CheckTotals } | null;
  previousAudits: { auditRunId: string; version: string | null; startedAt: string; totals: CheckTotals }[];
};

export function ThemeDetailTabs({ themeId }: { themeId: string }) {
  const [detail, setDetail] = useState<ThemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTabId, setActiveTabId] = useState("overview");
  const [selectedAuditRunId, setSelectedAuditRunId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/themes/${themeId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setDetail(data);
        // Default the embedded report to the latest audit the first time
        // data loads, without clobbering a report the user already picked
        // from Previous Audits on a subsequent refresh (e.g. after Run Audit).
        setSelectedAuditRunId((prev) => prev ?? data.latestAudit?._id ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [themeId]);

  useEffect(() => {
    load();
  }, [load]);

  function viewReport(auditRunId: string) {
    setSelectedAuditRunId(auditRunId);
    setActiveTabId("report");
  }

  if (loading) return <p className="mx-auto w-full max-w-5xl px-6 py-16 text-sm text-zinc-500">Loading…</p>;
  if (notFound || !detail) return <p className="mx-auto w-full max-w-5xl px-6 py-16 text-sm text-zinc-500">Theme not found.</p>;

  return (
    <TabbedPageClient
      title={detail.theme.name}
      defaultTabId="overview"
      orientation="vertical"
      activeTabId={activeTabId}
      onTabChange={setActiveTabId}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <OverviewPanel
              themeId={detail.theme._id}
              themeName={detail.theme.name}
              demoStorePresets={detail.theme.demoStorePresets ?? []}
              latestVersion={detail.latestVersion}
              latestAudit={detail.latestAudit}
              checkTotals={detail.checks?.totals ?? null}
              onChanged={load}
              onViewReport={viewReport}
            />
          ),
        },
        {
          id: "all-checks",
          label: "All Checks",
          content: detail.checks ? (
            <AllChecksList categories={detail.checks.categories} />
          ) : (
            <p className="text-sm text-zinc-500">Run an audit to see every check&apos;s status.</p>
          ),
        },
        {
          id: "report",
          label: "Report",
          content: selectedAuditRunId ? (
            <ReportContent key={selectedAuditRunId} auditRunId={selectedAuditRunId} showHeading={false} />
          ) : (
            <p className="text-sm text-zinc-500">Run an audit, or pick one from Previous Audits, to see its full report.</p>
          ),
        },
        {
          id: "previous-audits",
          label: "Previous Audits",
          content: <PreviousAuditsTable audits={detail.previousAudits} onSelect={viewReport} />,
        },
      ]}
    />
  );
}
