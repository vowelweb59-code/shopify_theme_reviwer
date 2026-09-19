"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Palette } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { AddThemeModal } from "./_components/AddThemeModal";
import { FeatureMatrixTable } from "./_components/FeatureMatrixTable";
import type { ScoreCard } from "@/lib/themes/computeScoreboard";
import { computeUpdatePriority, type UpdatePriorityResult } from "@/lib/themes/updatePriority";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type ThemeRow = {
  theme: {
    _id: string;
    name: string;
    themeStoreFeatures?: string[];
    themeStoreVersion?: string | null;
    themeStoreVersionReleasedAt?: string | null;
  };
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string; enhancementDetections?: { pointId: string; detected: boolean }[] } | null;
  checkTotals: CheckTotals | null;
  scoreboard: ScoreCard[] | null;
};

type PrioritizedThemeRow = ThemeRow & { priority: UpdatePriorityResult };

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

function scoreCard(scoreboard: ScoreCard[] | null, id: string): ScoreCard | undefined {
  return scoreboard?.find((c) => c.id === id);
}

function scoreCell(card: ScoreCard | undefined) {
  if (!card || card.score === null) return <span className="text-zinc-400">—</span>;
  return <span className={`font-semibold ${healthTone(card.score)}`}>{card.score}%</span>;
}

const STALE_THRESHOLD_DAYS = 90;

function isVersionMismatch(r: ThemeRow): boolean {
  const uploaded = r.latestVersion?.version;
  const live = r.theme.themeStoreVersion;
  return Boolean(uploaded && live && uploaded !== live);
}

function isStale(daysSinceUpdate: number | null): boolean {
  return daysSinceUpdate !== null && daysSinceUpdate > STALE_THRESHOLD_DAYS;
}

// A row is flagged for at most one reason visually (a colored left border +
// tint) — version mismatch takes precedence over plain staleness since it's
// the more actionable signal ("re-upload the current ZIP" vs. "check back
// later"), even though both conditions can be true at once.
function rowTone(r: PrioritizedThemeRow): "mismatch" | "stale" | null {
  if (isVersionMismatch(r)) return "mismatch";
  if (isStale(r.priority.daysSinceUpdate)) return "stale";
  return null;
}

const ROW_TONE_CLASS: Record<"mismatch" | "stale", string> = {
  mismatch: "border-l-4 border-l-status-fail-icon bg-status-fail-bg/40",
  stale: "border-l-4 border-l-status-warning-icon bg-status-warning-bg/40",
};

function withPriority(row: ThemeRow): PrioritizedThemeRow {
  return {
    ...row,
    priority: computeUpdatePriority({
      themeStoreVersionReleasedAt: row.theme.themeStoreVersionReleasedAt,
      featuresScore: scoreCard(row.scoreboard, "features")?.score ?? null,
      desktopPerformanceScore: scoreCard(row.scoreboard, "desktop-performance")?.score ?? null,
      mobilePerformanceScore: scoreCard(row.scoreboard, "mobile-performance")?.score ?? null,
      opportunitiesScore: scoreCard(row.scoreboard, "opportunities")?.score ?? null,
    }),
  };
}

export default function ThemesPage() {
  const [rows, setRows] = useState<PrioritizedThemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkAllProgress, setCheckAllProgress] = useState<{ done: number; total: number } | null>(null);

  function load() {
    fetch("/api/themes")
      .then((res) => res.json())
      .then((data) => {
        const prioritized = ((data.themes ?? []) as ThemeRow[]).map(withPriority);
        // Default order: the theme most in need of an update first. Ties
        // (including every theme with no data at all, score: null) keep
        // the API's own name-ascending order via a stable sort.
        prioritized.sort((a, b) => {
          if (a.priority.score === null && b.priority.score === null) return 0;
          if (a.priority.score === null) return 1;
          if (b.priority.score === null) return -1;
          return b.priority.score - a.priority.score;
        });
        setRows(prioritized);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  // "Last Update"/version-mismatch data only exists for a theme once its
  // Theme Store listing has been checked (a per-theme, on-request action —
  // see OverviewPanel's "Check Theme Store" button) — a real chore across a
  // long theme list, so this runs that same check for every theme here,
  // one at a time (a burst of a dozen simultaneous external page fetches
  // would be impolite and easy to rate-limit), then reloads once done.
  async function handleCheckAllThemeStores() {
    setCheckingAll(true);
    setCheckAllProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i++) {
      try {
        await fetch(`/api/themes/${rows[i].theme._id}/theme-store-features`, { method: "POST" });
      } catch {
        // Best-effort — one theme's listing failing to fetch shouldn't stop the rest.
      }
      setCheckAllProgress({ done: i + 1, total: rows.length });
    }
    setCheckingAll(false);
    setCheckAllProgress(null);
    load();
  }

  const columns: TableColumn<PrioritizedThemeRow>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => (
        <Link href={`/themes/${r.theme._id}`} className="font-medium text-zinc-950 hover:text-primary hover:underline dark:text-zinc-50">
          {r.theme.name}
        </Link>
      ),
      sortValue: (r) => r.theme.name,
    },
    {
      key: "version",
      header: "Current Version",
      render: (r) => {
        if (!r.latestVersion) return <span className="text-zinc-400">—</span>;
        const mismatch = isVersionMismatch(r);
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs">{r.latestVersion.version}</span>
            {mismatch && (
              <span
                className="rounded-full bg-status-fail-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-fail-text"
                title="The uploaded ZIP's version doesn't match the version currently live on the Shopify Theme Store."
              >
                Theme Store: {r.theme.themeStoreVersion}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "lastUpdate",
      header: "Last Update",
      render: (r) => {
        const releasedAt = r.theme.themeStoreVersionReleasedAt;
        if (!releasedAt) return <span className="text-zinc-400">—</span>;
        const stale = isStale(r.priority.daysSinceUpdate);
        return (
          <span className={stale ? "font-medium text-status-warning-text" : ""}>
            {formatDate(releasedAt)}
            {stale && <span className="ml-1 text-xs">({r.priority.daysSinceUpdate}d ago)</span>}
          </span>
        );
      },
      sortValue: (r) => (r.theme.themeStoreVersionReleasedAt ? new Date(r.theme.themeStoreVersionReleasedAt).getTime() : -1),
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

  // Deliberately narrower than the 8-card scoreboard: only Features,
  // Future Updates (Opportunities), and both Performance scores — no
  // Accessibility/SEO/Internal Standards, and explicitly no Store
  // Requirement, per what this comparison is meant to answer ("which
  // themes cover what features/future-update opportunities, and how do
  // they perform"), not a full compliance comparison.
  const comparisonColumns: TableColumn<PrioritizedThemeRow>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => (
        <Link href={`/themes/${r.theme._id}`} className="font-medium text-zinc-950 hover:text-primary hover:underline dark:text-zinc-50">
          {r.theme.name}
        </Link>
      ),
      sortValue: (r) => r.theme.name,
    },
    {
      key: "features",
      header: "Features Covered",
      render: (r) => scoreCell(scoreCard(r.scoreboard, "features")),
      sortValue: (r) => scoreCard(r.scoreboard, "features")?.score ?? -1,
    },
    {
      key: "opportunities",
      header: "Future Updates Covered",
      render: (r) => scoreCell(scoreCard(r.scoreboard, "opportunities")),
      sortValue: (r) => scoreCard(r.scoreboard, "opportunities")?.score ?? -1,
    },
    {
      key: "desktop-performance",
      header: "Desktop Performance",
      render: (r) => scoreCell(scoreCard(r.scoreboard, "desktop-performance")),
      sortValue: (r) => scoreCard(r.scoreboard, "desktop-performance")?.score ?? -1,
    },
    {
      key: "mobile-performance",
      header: "Mobile Performance",
      render: (r) => scoreCell(scoreCard(r.scoreboard, "mobile-performance")),
      sortValue: (r) => scoreCard(r.scoreboard, "mobile-performance")?.score ?? -1,
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

      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-zinc-500">
              The theme most in need of an update is listed first — ranked by how long it&apos;s been since its last Theme Store release,
              feature coverage, Core Web Vitals, and future-update opportunities, together.{" "}
              <span className="inline-flex items-center gap-1 font-medium text-status-fail-text">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-status-fail-icon" /> Red rows
              </span>{" "}
              have a different version live on the Theme Store than what&apos;s uploaded here.{" "}
              <span className="inline-flex items-center gap-1 font-medium text-status-warning-text">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-status-warning-icon" /> Amber rows
              </span>{" "}
              haven&apos;t had a Theme Store release in over {STALE_THRESHOLD_DAYS} days.
            </p>
            <Button variant="secondary" size="sm" onClick={handleCheckAllThemeStores} loading={checkingAll}>
              {checkingAll ? `Checking ${checkAllProgress?.done ?? 0}/${checkAllProgress?.total ?? rows.length}…` : "Check All Theme Stores"}
            </Button>
          </div>
          <ResponsiveTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.theme._id}
            theadClassName="bg-primary-tint text-primary-tint-text"
            rowClassName={(r) => {
              const tone = rowTone(r);
              return tone ? ROW_TONE_CLASS[tone] : "";
            }}
          />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Compare Themes</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Features, future-update opportunities, and performance across every theme&apos;s latest audit.
            </p>
          </div>
          <ResponsiveTable
            columns={comparisonColumns}
            rows={rows}
            rowKey={(r) => r.theme._id}
            theadClassName="bg-primary-tint text-primary-tint-text"
          />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Feature Availability</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Every feature in the catalog, per theme — a{" "}
              <span className="inline-flex items-center gap-1 font-medium text-status-pass-text">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-status-pass-icon" /> green check
              </span>{" "}
              means it was detected in that theme&apos;s latest audit (directly, or confirmed via its Shopify Theme Store listing); an{" "}
              <span className="inline-flex items-center gap-1 font-medium text-status-warning-text">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-status-warning-icon" /> orange check
              </span>{" "}
              means the Theme Store listing names it but our own code check didn&apos;t detect it — worth a second look.
            </p>
          </div>
          <FeatureMatrixTable rows={rows} />
        </div>
      )}
    </PageContainer>
  );
}
