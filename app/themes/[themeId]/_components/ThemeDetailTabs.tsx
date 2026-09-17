"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { Breadcrumbs } from "@/app/_components/shell/Breadcrumbs";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { ReportContent } from "@/app/reports/ReportContent";
import type { CategoryChecks } from "@/lib/themes/deriveChecksForAuditRun";
import type { ScoreCard } from "@/lib/themes/computeScoreboard";
import type { DemoStorePreset } from "@/app/_components/PresetLinksEditor";
import { OverviewPanel } from "./OverviewPanel";
import { AllChecksList } from "./AllChecksList";
import { VersionsSection } from "./VersionsSection";
import { AuditHistoryTable } from "./AuditHistoryTable";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type ThemeDetail = {
  theme: { _id: string; name: string; demoStorePresets?: DemoStorePreset[] };
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
  const [selectedAuditRunId, setSelectedAuditRunId] = useState<string | null>(null);
  // Which category All Checks should open pre-filtered to, and which
  // Findings/Future-updates sub-tab the Report should open on — both set by
  // clicking a scoreboard card's heading (see navigateToScoreCard below).
  // The `token` forces AllChecksList/ReportContent to remount (via `key`)
  // even when the target category/tab is unchanged from last time.
  const [checksJump, setChecksJump] = useState<{ category: string; token: number } | null>(null);
  const [reportJump, setReportJump] = useState<{ tab: "findings" | "future-updates"; token: number } | null>(null);

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

  function jumpToChecksCategory(category: string) {
    setChecksJump((prev) => ({ category, token: (prev?.token ?? 0) + 1 }));
    setActiveTabId("all-checks");
  }

  function jumpToReportTab(tab: "findings" | "future-updates") {
    setReportJump((prev) => ({ tab, token: (prev?.token ?? 0) + 1 }));
    setActiveTabId("report");
  }

  // Maps a scoreboard card to the specific section of the page that answers
  // "why is this score what it is" — see ScoreboardGrid's own comment for
  // why "Features" isn't handled here (it's a plain link, not a jump).
  function navigateToScoreCard(card: ScoreCard) {
    const presentCategories = new Set(detail?.checks?.categories.map((c) => c.category) ?? []);
    switch (card.id) {
      case "accessibility":
        jumpToChecksCategory("Accessibility");
        break;
      case "seo":
        // SEO combines Technical SEO + Technical AEO into one score, but All
        // Checks can only filter to one category at a time — SEO is picked
        // first since it's the larger/more common of the two.
        jumpToChecksCategory(presentCategories.has("Technical SEO") ? "Technical SEO" : "Technical AEO");
        break;
      case "store-requirement":
        jumpToChecksCategory("Theme Store Compliance");
        break;
      case "internal-standards":
        jumpToChecksCategory("Internal Standard");
        break;
      case "desktop-performance":
      case "mobile-performance":
        jumpToReportTab("findings");
        break;
      case "opportunities":
        jumpToReportTab("future-updates");
        break;
    }
  }

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
                onChanged={load}
                onNavigateScoreCard={navigateToScoreCard}
              />
            ),
          },
          {
            id: "all-checks",
            label: "All Checks",
            content: detail.checks ? (
              <AllChecksList
                key={checksJump ? `${checksJump.category}-${checksJump.token}` : "default"}
                categories={detail.checks.categories}
                initialCategoryFilter={checksJump?.category ?? ""}
              />
            ) : (
              <p className="text-sm text-zinc-500">Run an audit to see every check&apos;s status.</p>
            ),
          },
          {
            id: "versions",
            label: "Versions",
            content: (
              <VersionsSection
                versions={detail.versions}
                latestVersionId={detail.latestVersion?._id ?? null}
                totalsByVersion={totalsByVersion}
                onViewHistory={() => setActiveTabId("audit-history")}
              />
            ),
          },
          {
            id: "report",
            label: "Report",
            content: selectedAuditRunId ? (
              <ReportContent
                key={`${selectedAuditRunId}:${reportJump?.token ?? 0}`}
                auditRunId={selectedAuditRunId}
                showHeading={false}
                initialTab={reportJump?.tab ?? "findings"}
              />
            ) : (
              <p className="text-sm text-zinc-500">Run an audit, or pick one from Audit History, to see its full report.</p>
            ),
          },
          {
            id: "audit-history",
            label: "Audit History",
            content: <AuditHistoryTable audits={detail.previousAudits} onSelect={viewReport} />,
          },
        ]}
      />
    </PageContainer>
  );
}
