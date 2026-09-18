"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { Breadcrumbs } from "@/app/_components/shell/Breadcrumbs";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import type { CategoryChecks } from "@/lib/themes/deriveChecksForAuditRun";
import type { ScoreCard } from "@/lib/themes/computeScoreboard";
import type { DemoStorePreset } from "@/app/_components/PresetLinksEditor";
import { OverviewPanel } from "./OverviewPanel";
import { VersionsSection } from "./VersionsSection";
import { DownloadReportDropdown } from "./DownloadReportDropdown";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type ThemeDetail = {
  theme: { _id: string; name: string; demoStorePresets?: DemoStorePreset[]; googleSheetUrl?: string | null };
  versions: { _id: string; version: string; createdAt: string }[];
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checks: { categories: CategoryChecks[]; totals: CheckTotals } | null;
  scoreboard: ScoreCard[] | null;
  previousAudits: { auditRunId: string; version: string | null; startedAt: string; totals: CheckTotals }[];
};

export function ThemeDetailTabs({ themeId }: { themeId: string }) {
  const [detail, setDetail] = useState<ThemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTabId, setActiveTabId] = useState("");

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
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [themeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Latest completed audit's totals per ThemeVersion, derived from the
  // already-fetched previousAudits list (sorted newest-first) rather than a
  // new endpoint — the first row seen for a given version is its latest.
  const totalsByVersion = useMemo(() => {
    const map = new Map<string, CheckTotals>();
    if (!detail) return map;
    for (const audit of detail.previousAudits) {
      const version = detail.versions.find((v) => v.version === audit.version);
      if (version && !map.has(version._id)) map.set(version._id, audit.totals);
    }
    return map;
  }, [detail]);

  if (loading) return <PageContainer><p className="text-sm text-zinc-500">Loading…</p></PageContainer>;
  if (notFound || !detail) return <PageContainer><p className="text-sm text-zinc-500">Theme not found.</p></PageContainer>;

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Themes", href: "/themes" }, { label: detail.theme.name }]} />
      <TabbedPageClient
        title={detail.theme.name}
        titleAction={
          detail.latestAudit && (
            <DownloadReportDropdown auditRunId={detail.latestAudit._id} hasExistingSheet={Boolean(detail.theme.googleSheetUrl)} />
          )
        }
        defaultTabId=""
        orientation="vertical"
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            pinned: true,
            content: (
              <OverviewPanel
                themeId={detail.theme._id}
                themeName={detail.theme.name}
                demoStorePresets={detail.theme.demoStorePresets ?? []}
                latestVersion={detail.latestVersion}
                latestAudit={detail.latestAudit}
                checkTotals={detail.checks?.totals ?? null}
                scoreboard={detail.scoreboard}
                categories={detail.checks?.categories ?? []}
                onChanged={load}
              />
            ),
          },
          {
            id: "versions",
            label: "Versions",
            content: (
              <VersionsSection versions={detail.versions} latestVersionId={detail.latestVersion?._id ?? null} totalsByVersion={totalsByVersion} />
            ),
          },
        ]}
      />
    </PageContainer>
  );
}
