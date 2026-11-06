"use client";

import { Download, ExternalLink, Layers, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/app/_components/formatDate";
import { Button } from "@/app/_components/ui/Button";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";
import type { Analytics, CategoryInsight, PricingMix, StageInsight } from "@/lib/shopifyApps/analytics";

type StageKey = StageInsight["key"];
type Pricing = keyof PricingMix;
type StoreApp = {
  handle: string;
  name: string;
  url: string;
  tagline: string | null;
  rating: number | null;
  reviewCount: number;
  pricing: Pricing;
  builtForShopify: boolean;
  categories: string[];
  stages: StageKey[];
  developer: string | null;
  launchedAt: string | null;
};
type StoreData = { lastCrawledAt: string | null; analytics: Analytics; categoryLabels: Record<string, string>; apps: StoreApp[] };
type Progress = { running: boolean; phase: "tree" | "listings" | "details" | null; total: number; done: number; current: string | null; appsSeen: number; errors: string[] };

const PHASE_LABEL = { tree: "Reading the category tree", listings: "Reading every category's apps", details: "Reading app pages (launch date, star split)" } as const;
const PRICING_LABEL: Record<Pricing, string> = { free: "Free", freemium: "Free plan", trial: "Free trial", paid: "Paid", unknown: "Unknown" };
const dash = <span className="text-zinc-400">—</span>;
const num = (n: number) => n.toLocaleString();
const pctText = (n: number | null, digits = 0) => (n === null ? "—" : `${(n * 100).toFixed(digits)}%`);

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-right text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function MixBar({ mix }: { mix: PricingMix }) {
  const total = Object.values(mix).reduce((s, n) => s + n, 0) || 1;
  const parts: [Pricing, string][] = [["free", "bg-emerald-500"], ["freemium", "bg-sky-500"], ["trial", "bg-amber-500"], ["paid", "bg-violet-500"]];
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="img" aria-label={parts.map(([k]) => `${PRICING_LABEL[k]} ${Math.round((mix[k] / total) * 100)}%`).join(", ")}>
      {parts.map(([k, color]) => (
        <div key={k} className={color} style={{ width: `${(mix[k] / total) * 100}%` }} />
      ))}
    </div>
  );
}

function StageCard({ stage, index, selected, onSelect, years }: { stage: StageInsight; index: number; selected: boolean; onSelect: () => void; years: number[] }) {
  const recent = years.slice(-5);
  const max = Math.max(1, ...recent.map((y) => stage.launchesByYear[y] ?? 0));
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${selected ? "border-primary bg-primary-tint" : "border-border-subtle hover:border-zinc-400"}`}
    >
      <span className="text-xs font-medium text-zinc-500">Stage {index + 1}</span>
      <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{stage.label}</span>
      <span className="text-xs text-zinc-500">{stage.question}</span>
      <span className="text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
        {num(stage.apps)} apps · {num(stage.reviews)} reviews · {stage.categories} categories
      </span>
      <MixBar mix={stage.pricing} />
      {recent.length > 0 && (
        <div className="flex h-8 items-end gap-1" role="img" aria-label={`Launches per year: ${recent.map((y) => `${y}: ${stage.launchesByYear[y] ?? 0}`).join(", ")}`}>
          {recent.map((y) => (
            <div key={y} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="w-full rounded-sm bg-zinc-400 dark:bg-zinc-600" style={{ height: `${Math.max(2, ((stage.launchesByYear[y] ?? 0) / max) * 24)}px` }} />
              <span className="text-[9px] text-zinc-500">{String(y).slice(2)}</span>
            </div>
          ))}
        </div>
      )}
      {stage.best ? (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          Biggest gap: <strong>{stage.best.label}</strong> ({stage.best.gap})
        </span>
      ) : (
        <span className="text-xs text-zinc-400">Not scored yet</span>
      )}
    </button>
  );
}

function WhyPanel({ category, onClose }: { category: CategoryInsight; onClose: () => void }) {
  const c = category.components;
  const rows: [string, number | undefined, string][] = [
    ["Demand", c?.demand, "reviews in the category vs. other categories"],
    ["Weak leaders", c?.weakness, "low ratings / 1–2 star share among the leaders"],
    ["Open market", c?.openness, "no lock-in by a few apps or Built for Shopify badges; newcomers breaking out"],
    ["Headroom", c?.headroom, "reviews per competing app"],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-subtle p-4" aria-label={`Why ${category.label} scores ${category.gap}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          {category.label} — opportunity {category.gap ?? "not scored"}
        </h3>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Close
        </button>
      </div>
      {category.reasons.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {category.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{category.gap === null ? "Fewer than 5 apps — too few to score." : "No single strong signal; the score is a middling mix."}</p>
      )}
      {c && (
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map(([label, v, hint]) => (
            <div key={label}>
              <dt className="flex justify-between text-xs font-medium">
                <span>{label}</span>
                <span className="tabular-nums">{Math.round((v ?? 0) * 100)}th percentile</span>
              </dt>
              <dd>
                <div className="my-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-primary" style={{ width: `${(v ?? 0) * 100}%` }} />
                </div>
                <span className="text-xs text-zinc-500">{hint}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">The apps to beat</h4>
        <ul className="text-sm">
          {category.topApps.map((a) => (
            <li key={a.handle} className="flex justify-between gap-3 py-0.5">
              <a href={`https://apps.shopify.com/${a.handle}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {a.name}
              </a>
              <span className="tabular-nums text-zinc-500">
                {a.rating ?? "—"}★ · {num(a.reviewCount)} reviews
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ShopifyAppStoreTab() {
  const { data, loading, error, reload } = useApi<StoreData>("/api/shopify-apps");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [view, setView] = useState<"opportunities" | "apps">("opportunities");
  const [stage, setStage] = useState<StageKey | "">("");
  const [category, setCategory] = useState("");
  const [pricing, setPricing] = useState<Pricing | "">("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Poll while a read runs (and once on mount, to pick up one already running).
  const running = progress?.running ?? false;
  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch("/api/shopify-apps/crawl");
        if (!stop && res.ok) setProgress((await res.json()) as Progress);
      } catch {
        /* the next tick retries */
      }
    }
    void poll();
    if (!running) return () => void (stop = true);
    const id = setInterval(() => {
      void poll();
      reload();
    }, 10_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [running, reload]);

  async function startCrawl() {
    setStartError(null);
    const res = await fetch("/api/shopify-apps/crawl", { method: "POST" });
    if (!res.ok) return setStartError("Couldn't start reading the App Store.");
    setProgress((await res.json()) as Progress);
  }

  const analytics = data?.analytics;
  const apps = useMemo(() => data?.apps ?? [], [data]);
  const labels = data?.categoryLabels;
  const stageLabel = (k: StageKey) => analytics?.stages.find((s) => s.key === k)?.label ?? k;

  const categories = useMemo(() => (analytics?.categories ?? []).filter((c) => !stage || c.stage === stage), [analytics, stage]);
  const shownApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter(
      (a) =>
        (!stage || a.stages.includes(stage)) &&
        (!category || a.categories.includes(category)) &&
        (!pricing || a.pricing === pricing) &&
        (!q || a.name.toLowerCase().includes(q) || (a.developer ?? "").toLowerCase().includes(q) || (a.tagline ?? "").toLowerCase().includes(q))
    );
  }, [apps, stage, category, pricing, query]);
  const openCategory = analytics?.categories.find((c) => c.slug === open) ?? null;

  function exportCsv() {
    const cell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["App", "Developer", "Stages", "Categories", "Rating", "Reviews", "Pricing", "Built for Shopify", "Launched", "Link"];
    const lines = shownApps.map((a) =>
      [a.name, a.developer, a.stages.map(stageLabel).join("; "), a.categories.map((s) => labels?.[s] ?? s).join("; "), a.rating, a.reviewCount, PRICING_LABEL[a.pricing], a.builtForShopify ? "Yes" : "", a.launchedAt, a.url].map(cell).join(",")
    );
    const url = URL.createObjectURL(new Blob([[header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopify-app-store-apps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const opportunityColumns: TableColumn<CategoryInsight>[] = [
    { key: "gap", header: "Opportunity", render: (c) => (c.gap === null ? <span className="text-xs text-zinc-400">too few apps</span> : <ScoreBar value={c.gap} />), sortValue: (c) => c.gap ?? -1 },
    {
      key: "category",
      header: "Category (the job)",
      render: (c) => (
        <button type="button" onClick={() => setOpen(c.slug)} className="text-left font-medium text-zinc-950 hover:text-primary dark:text-zinc-50">
          {c.label}
        </button>
      ),
      sortValue: (c) => c.label.toLowerCase(),
    },
    { key: "stage", header: "Lifecycle stage", render: (c) => <span className="text-xs">{stageLabel(c.stage)}</span>, sortValue: (c) => c.stage },
    { key: "apps", header: "Apps", render: (c) => <span className="tabular-nums">{num(c.apps)}</span>, sortValue: (c) => c.apps, className: "text-right" },
    { key: "reviews", header: "Reviews", render: (c) => <span className="tabular-nums">{num(c.reviews)}</span>, sortValue: (c) => c.reviews, className: "text-right" },
    { key: "rpa", header: "Reviews / app", render: (c) => <span className="tabular-nums">{num(Math.round(c.reviewsPerApp))}</span>, sortValue: (c) => c.reviewsPerApp, className: "text-right" },
    { key: "leaders", header: "Leaders ★", render: (c) => (c.leaderRating === null ? dash : <span className="tabular-nums">{c.leaderRating.toFixed(2)}</span>), sortValue: (c) => c.leaderRating ?? 99, className: "text-right" },
    { key: "low", header: "1–2★ share", render: (c) => (c.lowStarShare === null ? dash : <span className="tabular-nums">{c.lowStarShare.toFixed(1)}%</span>), sortValue: (c) => c.lowStarShare ?? -1, className: "text-right" },
    { key: "top3", header: "Top-3 hold", render: (c) => <span className="tabular-nums">{pctText(c.top3Share)}</span>, sortValue: (c) => c.top3Share, className: "text-right" },
    { key: "bfs", header: "Built for Shopify (top 10)", render: (c) => <span className="tabular-nums">{pctText(c.bfsShare)}</span>, sortValue: (c) => c.bfsShare, className: "text-right" },
    { key: "break", header: "New breakouts", render: (c) => <span className="tabular-nums">{c.breakouts || "—"}</span>, sortValue: (c) => c.breakouts, className: "text-right" },
    { key: "l12", header: "Launched 12 mo", render: (c) => <span className="tabular-nums">{c.launches12m || "—"}</span>, sortValue: (c) => c.launches12m, className: "text-right" },
    { key: "pricing", header: "Pricing mix", render: (c) => <div className="w-24"><MixBar mix={c.pricing} /></div> },
  ];

  const appColumns: TableColumn<StoreApp>[] = [
    {
      key: "app",
      header: "App",
      render: (a) => (
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-zinc-950 hover:text-primary dark:text-zinc-50">
          {a.name}
          <ExternalLink className="h-3 w-3 text-zinc-400" aria-hidden />
        </a>
      ),
      sortValue: (a) => a.name.toLowerCase(),
    },
    { key: "dev", header: "Developer", render: (a) => (a.developer ? <span className="text-xs">{a.developer}</span> : dash), sortValue: (a) => (a.developer ?? "~").toLowerCase() },
    { key: "stages", header: "Lifecycle stage", render: (a) => (a.stages.length ? <span className="text-xs">{a.stages.map(stageLabel).join(" · ")}</span> : dash) },
    { key: "cats", header: "Categories", render: (a) => <span className="text-xs text-zinc-600 dark:text-zinc-400">{a.categories.map((s) => labels?.[s] ?? s).join(", ") || "—"}</span> },
    { key: "rating", header: "★", render: (a) => (a.rating === null ? dash : <span className="tabular-nums">{a.rating.toFixed(1)}</span>), sortValue: (a) => a.rating ?? -1, className: "text-right" },
    { key: "reviews", header: "Reviews", render: (a) => <span className="tabular-nums">{num(a.reviewCount)}</span>, sortValue: (a) => a.reviewCount, className: "text-right" },
    { key: "pricing", header: "Pricing", render: (a) => <span className="text-xs">{PRICING_LABEL[a.pricing]}</span>, sortValue: (a) => a.pricing },
    { key: "bfs", header: "BFS", render: (a) => (a.builtForShopify ? <span className="text-xs font-medium text-status-pass-text">Yes</span> : dash), sortValue: (a) => (a.builtForShopify ? 1 : 0) },
    { key: "launched", header: "Launched", render: (a) => (a.launchedAt ? <span className="text-xs tabular-nums">{a.launchedAt}</span> : dash), sortValue: (a) => a.launchedAt ?? "" },
  ];

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const coverage = analytics?.coverage;
  const select = "rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Shopify App Store</h2>
      <p className="max-w-3xl text-sm text-zinc-500">
        Every app on{" "}
        <a href="https://apps.shopify.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          apps.shopify.com
        </a>
        , grouped by the stage of a merchant&apos;s journey it makes easier rather than by Shopify&apos;s own categories. Each Shopify category is a &ldquo;job&rdquo;; the <strong>opportunity score</strong> (0–100) ranks the jobs by demand
        (reviews), weak leaders, an open market and demand per competitor — see why for any category. A read takes roughly 25 minutes and is repeated daily; app pages (launch date, star split) are read 400 at a time, most-reviewed first.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={startCrawl} disabled={running}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${running ? "animate-spin" : ""}`} aria-hidden />
          {running ? "Reading…" : apps.length > 0 ? "Refresh App Store" : "Read App Store"}
        </Button>
        {view === "apps" && (
          <Button type="button" onClick={exportCsv} disabled={shownApps.length === 0}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        )}
        {data?.lastCrawledAt && <span className="text-xs text-zinc-500">Last updated {formatDateTime(data.lastCrawledAt)}</span>}
      </div>

      {progress?.running && progress.phase && (
        <div className="flex flex-col gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-zinc-500">
            {PHASE_LABEL[progress.phase]} · {progress.done} of {progress.total}
            {progress.current ? ` (${progress.current})` : ""} · {num(progress.appsSeen)} apps seen
          </p>
        </div>
      )}
      {progress && !progress.running && progress.errors.length > 0 && (
        <p className="text-xs text-status-fail-text">
          {progress.errors.length} problem{progress.errors.length === 1 ? "" : "s"}: {progress.errors.slice(0, 5).join("; ")}
          {progress.errors.length > 5 ? "…" : ""}
        </p>
      )}
      {(error || startError) && <p className="text-sm text-status-fail-text">{error ?? startError}</p>}

      {!loading && apps.length === 0 ? (
        <EmptyState icon={Layers} title="No App Store apps yet" description="Press “Read App Store” to read the categories and apps." />
      ) : (
        analytics && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {analytics.stages.map((s, i) => (
                <StageCard key={s.key} stage={s} index={i} years={analytics.launchYears} selected={stage === s.key} onSelect={() => setStage(stage === s.key ? "" : s.key)} />
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              {num(analytics.coverage.apps)} apps. Launch dates and star splits are read for {coverage ? num(coverage.withDetails) : 0} so far ({coverage && coverage.apps ? Math.round((coverage.withDetails / coverage.apps) * 100) : 0}%) — newcomer and
              1–2★ figures use only those. Pricing shows the free-tier label on each card (price points aren&apos;t comparable across currencies): <span className="text-emerald-600">free</span> ·{" "}
              <span className="text-sky-600">free plan</span> · <span className="text-amber-600">free trial</span> · <span className="text-violet-600">paid</span>. {stage ? `Showing ${stageLabel(stage)} only — click it again to clear.` : "Click a stage to filter."}
            </p>

            <div role="tablist" aria-label="App Store views" className="flex gap-1 border-b border-border-subtle">
              {([["opportunities", "Opportunities by category"], ["apps", "All apps"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === key ? "border-primary font-medium text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "opportunities" ? (
              <>
                {openCategory && <WhyPanel category={openCategory} onClose={() => setOpen(null)} />}
                <ResponsiveTable columns={opportunityColumns} rows={categories} rowKey={(c) => c.slug} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={25} emptyMessage="No categories." />
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={select}>
                    <option value="">All categories</option>
                    {analytics.categories
                      .filter((c) => !stage || c.stage === stage)
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                  </select>
                  <select value={pricing} onChange={(e) => setPricing(e.target.value as Pricing | "")} aria-label="Pricing" className={select}>
                    <option value="">Any pricing</option>
                    {(["free", "freemium", "trial", "paid"] as const).map((p) => (
                      <option key={p} value={p}>
                        {PRICING_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search app, developer or what it does" aria-label="Search" className="min-w-56 rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm" />
                  <span className="text-xs text-zinc-500">{num(shownApps.length)} apps</span>
                </div>
                <ResponsiveTable columns={appColumns} rows={shownApps} rowKey={(a) => a.handle} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={50} emptyMessage="No apps match." />
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
