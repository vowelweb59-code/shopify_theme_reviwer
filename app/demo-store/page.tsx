"use client";

import { useEffect, useState } from "react";
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
  themeStoreRank: number | null;
  themeStoreRankPage: number | null;
  themeStoreRankCheckedAt: string | null;
};

type DemoStoreData = {
  records: DemoStoreRecord[];
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastError: string | null;
};

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
  const [checkingRanking, setCheckingRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  function load() {
    fetch("/api/demo-store")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
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
    setRankingError(null);
    try {
      const res = await fetch("/api/demo-store/check-ranking", { method: "POST" });
      const body = await res.json();
      if (!body.ok) setRankingError(body.error ?? "Failed to check ranking.");
    } catch {
      setRankingError("Failed to reach the app's own server.");
    } finally {
      setCheckingRanking(false);
      load();
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

  // One row per distinct theme id (not per history period, unlike the
  // table above) — a theme's Theme Store rank doesn't depend on which
  // stretch of demo-store time it's being viewed from.
  const rankingRows = data
    ? Array.from(new Map(data.records.map((r) => [r.shopifyThemeId, r])).values()).sort(
        (a, b) => (a.themeStoreRank ?? Infinity) - (b.themeStoreRank ?? Infinity)
      )
    : [];

  const rankingColumns: TableColumn<DemoStoreRecord>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => <span className="font-medium text-zinc-950 dark:text-zinc-50">{r.themeName}</span>,
      sortValue: (r) => r.themeName,
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
        ) : (
          <span className="text-xs text-zinc-400">Not listed yet</span>
        ),
    },
    {
      key: "rank",
      header: "Ranking",
      render: (r) =>
        r.themeStoreRank ? (
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            #{r.themeStoreRank}
            <span className="ml-1 font-normal text-zinc-500">(page {r.themeStoreRankPage})</span>
          </span>
        ) : r.themeStoreListed ? (
          <span className="text-xs text-zinc-400">Not checked yet</span>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
      sortValue: (r) => r.themeStoreRank ?? Infinity,
    },
    {
      key: "rankCheckedAt",
      header: "Checked",
      render: (r) => (r.themeStoreRankCheckedAt ? formatDateTime(r.themeStoreRankCheckedAt) : <span className="text-zinc-400">—</span>),
      sortValue: (r) => (r.themeStoreRankCheckedAt ? new Date(r.themeStoreRankCheckedAt).getTime() : 0),
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

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Theme Store Ranking</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                Where each of these themes sits in the public{" "}
                <a href="https://themes.shopify.com/themes" target="_blank" rel="noreferrer" className="underline hover:no-underline">
                  themes.shopify.com/themes
                </a>{" "}
                catalog, once it&apos;s listed. Found by crawling the catalog&apos;s default order page by page — a manual check, not part of the daily
                poll, since it can mean walking dozens of pages.
              </p>
            </div>
            <Button variant="secondary" onClick={handleCheckRanking} loading={checkingRanking}>
              Check Ranking
            </Button>
          </div>

          {rankingError && <p className="text-xs text-status-fail-text">{rankingError}</p>}

          {rankingRows.length === 0 ? (
            <EmptyState icon={Store} title="Nothing to rank yet" description="No demo-store theme has been confirmed on the Theme Store yet." />
          ) : (
            <ResponsiveTable
              columns={rankingColumns}
              rows={rankingRows}
              rowKey={(r) => String(r.shopifyThemeId)}
              theadClassName="bg-primary-tint text-primary-tint-text"
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
