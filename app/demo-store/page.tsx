"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { EmptyState } from "@/app/_components/ui/EmptyState";

const DEMO_STORE_URL = "https://theme-store-ops-admin.myshopify.com/";

type DemoStoreRecord = {
  _id: string;
  shopifyThemeId: number;
  themeName: string;
  schemaName: string | null;
  schemaVersion: string | null;
  startedAt: string;
  endedAt: string | null;
  themeStoreListed: boolean | null;
  themeStoreSlug: string | null;
  themeStoreCheckedAt: string | null;
};

type DemoStoreData = {
  records: DemoStoreRecord[];
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastError: string | null;
};

// The Themes-tab theme this ranking table is about — distinct from
// DemoStoreRecord above, which is the ops demo store's install history.
// "Our themes" here means whatever's tracked in the Themes module
// (app/themes), not whatever's happened to be live on the demo store.
type ThemeStorePreset = { name: string; slug: string; rank: number | null; page: number | null; previousRank: number | null };

type RankedTheme = {
  _id: string;
  name: string;
  themeStoreSlug: string | null;
  themeStoreCheckedAt: string | null;
  themeStoreError: string | null;
  themeStorePresets: ThemeStorePreset[] | null;
  themeStoreReviewCount: number | null;
  themeStorePositivePercent: number | null;
  themeStoreRank: number | null;
  themeStoreRankPage: number | null;
  themeStoreRankCheckedAt: string | null;
  themeStorePreviousRank: number | null;
};

type RankingData = {
  themes: RankedTheme[];
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastError: string | null;
};

// One row per theme AND one row per preset, flattened — a preset's row
// uses the exact same column formatting as its parent theme's, just in a
// lighter shade of the same color, rather than being crammed into the
// theme's own cell.
type RankRow = {
  id: string;
  isPreset: boolean;
  name: string;
  url: string | null;
  rank: number | null;
  previousRank: number | null;
  page: number | null;
  rankStatus: "not-checked" | "not-listed" | "unranked" | null;
  reviewCount: number | null;
  positivePercent: number | null;
};

function flattenRankRows(themes: RankedTheme[]): RankRow[] {
  const rows: RankRow[] = [];
  for (const t of themes) {
    rows.push({
      id: t._id,
      isPreset: false,
      name: t.name,
      url: t.themeStoreSlug ? `https://themes.shopify.com/themes/${t.themeStoreSlug}` : null,
      rank: t.themeStoreRank,
      previousRank: t.themeStorePreviousRank,
      page: t.themeStoreRankPage,
      rankStatus: t.themeStoreRank ? null : !t.themeStoreCheckedAt ? "not-checked" : t.themeStoreError ? "not-listed" : "unranked",
      reviewCount: t.themeStoreReviewCount,
      positivePercent: t.themeStorePositivePercent,
    });
    for (const p of t.themeStorePresets ?? []) {
      rows.push({
        id: `${t._id}-${p.slug}`,
        isPreset: true,
        name: p.name,
        url: t.themeStoreSlug ? `https://themes.shopify.com/themes/${t.themeStoreSlug}/presets/${p.slug}` : null,
        rank: p.rank,
        previousRank: p.previousRank,
        page: p.page,
        rankStatus: p.rank ? null : "unranked",
        // Reviews are theme-wide, not preset-specific (confirmed live: a
        // preset's own listing page shows the identical numbers) — reused
        // from the parent theme rather than fetched again per preset.
        reviewCount: t.themeStoreReviewCount,
        positivePercent: t.themeStorePositivePercent,
      });
    }
  }
  return rows;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function durationMs(startIso: string, endIso: string | null) {
  return (endIso ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
}

function formatDuration(ms: number) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days === 0 && hours === 0) return "<1h";
  if (days === 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}

export default function DemoStorePage() {
  const [data, setData] = useState<DemoStoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [checkingRanking, setCheckingRanking] = useState(false);

  function load() {
    fetch("/api/demo-store")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }

  function loadRanking() {
    fetch("/api/themes/ranking")
      .then((res) => res.json())
      .then((d) => {
        setRankingData(d);
        setRankingLoading(false);
      });
  }

  useEffect(() => {
    load();
    loadRanking();
  }, []);

  async function handleCheckNow() {
    setChecking(true);
    try {
      await fetch("/api/demo-store/check", { method: "POST" });
    } finally {
      setChecking(false);
      load();
    }
  }

  async function handleCheckRanking() {
    setCheckingRanking(true);
    try {
      await fetch("/api/themes/check-ranking", { method: "POST" });
    } finally {
      setCheckingRanking(false);
      loadRanking();
    }
  }

  const columns: TableColumn<DemoStoreRecord>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-950 dark:text-zinc-50">{r.themeName}</span>
          {!r.endedAt && (
            <span className="rounded-full bg-status-pass-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-pass-text">Current</span>
          )}
        </span>
      ),
      sortValue: (r) => r.themeName,
    },
    {
      key: "schema",
      header: "Schema",
      render: (r) =>
        r.schemaName ? (
          <span className="font-mono text-xs">
            {r.schemaName}
            {r.schemaVersion ? ` v${r.schemaVersion}` : ""}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: "installedFrom",
      header: "Installed From",
      render: (r) => formatDateTime(r.startedAt),
      sortValue: (r) => new Date(r.startedAt).getTime(),
    },
    {
      key: "installedUntil",
      header: "Installed Until",
      render: (r) => (r.endedAt ? formatDateTime(r.endedAt) : <span className="text-status-pass-text">Still live</span>),
      sortValue: (r) => (r.endedAt ? new Date(r.endedAt).getTime() : Date.now()),
    },
    {
      key: "duration",
      header: "Duration",
      render: (r) => formatDuration(durationMs(r.startedAt, r.endedAt)),
      sortValue: (r) => durationMs(r.startedAt, r.endedAt),
    },
    {
      key: "themeStore",
      header: "Theme Store",
      render: (r) =>
        r.themeStoreListed ? (
          <a
            href={`https://themes.shopify.com/themes/${r.themeStoreSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-status-pass-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-pass-text underline-offset-2 hover:underline"
          >
            Live on Theme Store
          </a>
        ) : r.themeStoreCheckedAt ? (
          <span className="text-xs text-zinc-400">Not listed yet</span>
        ) : (
          <span className="text-xs text-zinc-400">Checking…</span>
        ),
      sortValue: (r) => (r.themeStoreListed ? 1 : 0),
    },
  ];

  const RANK_STATUS_LABEL: Record<NonNullable<RankRow["rankStatus"]>, string> = {
    "not-checked": "Theme Store not checked",
    "not-listed": "Not listed",
    unranked: "Not checked yet",
  };

  const rankingColumns: TableColumn<RankRow>[] = [
    {
      key: "theme",
      header: "Theme",
      // Same format for a theme and a preset row — bold name, same size —
      // the only difference is color: full-strength primary for a theme,
      // a lighter tint of that same primary for its preset.
      render: (r) =>
        r.url ? (
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className={`font-semibold underline-offset-2 hover:underline ${r.isPreset ? "text-primary/60" : "text-primary"}`}
          >
            {r.name}
          </a>
        ) : (
          <span className={`font-semibold ${r.isPreset ? "text-primary/60" : "text-primary"}`}>{r.name}</span>
        ),
      sortValue: (r) => r.name,
    },
    {
      key: "rank",
      header: "Ranking",
      render: (r) =>
        r.rank ? (
          <span className={`font-medium ${r.isPreset ? "text-zinc-500" : "text-zinc-950 dark:text-zinc-50"}`}>
            #{r.rank}
            <span className={`ml-1 font-normal ${r.isPreset ? "text-zinc-400" : "text-zinc-500"}`}>(page {r.page})</span>
          </span>
        ) : (
          <span className="text-xs text-zinc-400">{r.rankStatus ? RANK_STATUS_LABEL[r.rankStatus] : "—"}</span>
        ),
      sortValue: (r) => r.rank ?? Infinity,
    },
    {
      key: "change",
      header: "Change",
      // A lower rank number is better, so previousRank - rank > 0 means it
      // moved up the catalog (gained) since the last check — not
      // necessarily exactly 24h ago, just whatever the prior check was.
      render: (r) => {
        if (r.rank == null || r.previousRank == null) return <span className="text-xs text-zinc-400">—</span>;
        const delta = r.previousRank - r.rank;
        if (delta === 0) return <span className="text-xs text-zinc-400">No change</span>;
        return (
          <span className={`text-xs font-semibold ${delta > 0 ? "text-status-pass-text" : "text-status-fail-text"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
          </span>
        );
      },
      sortValue: (r) => (r.rank != null && r.previousRank != null ? r.previousRank - r.rank : 0),
    },
    {
      key: "reviews",
      header: "Reviews",
      render: (r) => (r.reviewCount != null ? <span>{r.reviewCount}</span> : <span className="text-zinc-400">—</span>),
      sortValue: (r) => r.reviewCount ?? -1,
    },
    {
      key: "rating",
      header: "Average Rating",
      // The Theme Store doesn't publish a 1-5 star average — its own
      // rating metric is "NN% positive" of all reviews, so that's what's
      // shown here rather than a fabricated star score.
      render: (r) =>
        r.positivePercent != null ? (
          <span>
            {r.positivePercent}% <span className="text-zinc-400">positive</span>
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
      sortValue: (r) => r.positivePercent ?? -1,
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Shopify Demo Store</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Which theme has been live on{" "}
            <a href={DEMO_STORE_URL} target="_blank" rel="noreferrer" className="underline hover:no-underline">
              theme-store-ops-admin.myshopify.com
            </a>
            , and for how long. Checked automatically once a day at a randomized time (never more than once per 24h) by reading the storefront&apos;s
            publicly embedded theme info — only the currently published theme is visible this way, not the store&apos;s full theme library. The same
            daily check also watches the public Shopify Theme Store for each of these themes, so if one goes live there later it gets flagged below.
          </p>
        </div>
        <Button variant="secondary" onClick={handleCheckNow} loading={checking}>
          Check Now
        </Button>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && data && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500">
            Last checked: {data.lastCheckedAt ? formatDateTime(data.lastCheckedAt) : "never"}
            {" · "}
            Next automatic check: {data.nextCheckAt ? formatDateTime(data.nextCheckAt) : "—"}
            {data.lastError && <span className="ml-2 text-status-fail-text">Last check failed: {data.lastError}</span>}
          </p>

          {data.records.length === 0 ? (
            <EmptyState icon={Store} title="No checks yet" description="Click Check Now to record the store's currently live theme." />
          ) : (
            <ResponsiveTable columns={columns} rows={data.records} rowKey={(r) => r._id} theadClassName="bg-primary-tint text-primary-tint-text" />
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Theme Store Ranking</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Where each theme in the{" "}
            <Link href="/themes" className="underline hover:no-underline">
              Themes
            </Link>{" "}
            tab sits in the public{" "}
            <a href="https://themes.shopify.com/themes" target="_blank" rel="noreferrer" className="underline hover:no-underline">
              themes.shopify.com/themes
            </a>{" "}
            catalog, once it&apos;s listed there — including each of its named style presets separately, since a preset gets its own ranked card
            too (they can land on completely different pages from the theme&apos;s own default listing). Change shows how much a rank moved since
            the last check. Checked automatically once a day at a randomized time, same as the demo store poll above; a full crawl can mean walking
            dozens of pages, so it&apos;s not tied to that same daily check.
          </p>
        </div>
        <Button variant="secondary" onClick={handleCheckRanking} loading={checkingRanking}>
          Check Ranking
        </Button>
      </div>

      {rankingLoading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!rankingLoading && rankingData && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500">
            Last checked: {rankingData.lastCheckedAt ? formatDateTime(rankingData.lastCheckedAt) : "never"}
            {" · "}
            Next automatic check: {rankingData.nextCheckAt ? formatDateTime(rankingData.nextCheckAt) : "—"}
            {rankingData.lastError && <span className="ml-2 text-status-fail-text">Last check failed: {rankingData.lastError}</span>}
          </p>

          {rankingData.themes.length === 0 ? (
            <EmptyState icon={Store} title="No themes yet" description="Add a theme in the Themes tab first." />
          ) : (
            <ResponsiveTable
              columns={rankingColumns}
              rows={flattenRankRows(rankingData.themes)}
              rowKey={(r) => r.id}
              theadClassName="bg-primary-tint text-primary-tint-text"
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
