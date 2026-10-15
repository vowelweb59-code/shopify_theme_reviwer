"use client";

import { Download, ExternalLink, RefreshCw, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { formatDateTime } from "@/app/_components/formatDate";
import { useApi } from "@/app/analytics/_components/useApi";
import { INDUSTRIES, industryLabel } from "@/lib/themes/industries";

type StoreTheme = {
  slug: string;
  name: string;
  url: string;
  price: number | null;
  isNew: boolean;
  presetCount: number;
  industries: string[];
  designer: string | null;
  positivePercent: number | null;
  reviewCount: number | null;
  latestVersion: string | null;
  latestVersionReleasedAt: string | null;
  features: string[];
  rank: number | null;
};
type StoreData = { detailsPending: number; lastCrawledAt: string | null; themes: StoreTheme[] };
type Progress = { running: boolean; phase: "catalog" | "categories" | "details" | null; total: number; done: number; current: string | null; themesSeen: number; errors: string[]; finishedAt: string | null };

const PHASE_LABEL = { catalog: "Reading the catalog", categories: "Reading categories", details: "Reading theme pages" } as const;
const dash = <span className="text-zinc-400">—</span>;
const priceLabel = (p: number | null) => (p === null ? "—" : p === 0 ? "Free" : `$${p.toLocaleString()}`);

export function ThemeStoreCatalogSection() {
  const { data, loading, error, reload } = useApi<StoreData>("/api/theme-store");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [query, setQuery] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  // Poll while a crawl runs (and once on mount, to pick up one already running).
  const running = progress?.running ?? false;
  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch("/api/theme-store/crawl");
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
    }, 5_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [running, reload]);

  async function startCrawl() {
    setStartError(null);
    const res = await fetch("/api/theme-store/crawl", { method: "POST" });
    if (!res.ok) return setStartError("Couldn't start reading the Theme Store.");
    setProgress((await res.json()) as Progress);
  }

  const themes = useMemo(() => data?.themes ?? [], [data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return themes.filter(
      (t) =>
        (!category || (category === "none" ? t.industries.length === 0 : t.industries.includes(category))) &&
        (!price || (price === "free" ? t.price === 0 : t.price !== null && t.price > 0)) &&
        (!q || t.name.toLowerCase().includes(q) || (t.designer ?? "").toLowerCase().includes(q) || t.features.some((f) => f.toLowerCase().includes(q)))
    );
  }, [themes, category, price, query]);

  function exportCsv() {
    const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Rank", "Theme", "Designer", "Price", "Positive %", "Reviews", "Presets", "Categories", "Latest version", "Released", "Features", "Link"];
    const lines = shown.map((t) =>
      [t.rank, t.name, t.designer, t.price, t.positivePercent, t.reviewCount, t.presetCount, t.industries.map(industryLabel).join("; "), t.latestVersion, t.latestVersionReleasedAt, t.features.join("; "), t.url].map(cell).join(",")
    );
    const url = URL.createObjectURL(new Blob([[header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopify-theme-store-themes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: TableColumn<StoreTheme>[] = [
    { key: "rank", header: "#", render: (t) => <span className="tabular-nums text-zinc-500">{t.rank ?? "—"}</span>, sortValue: (t) => t.rank ?? Number.MAX_SAFE_INTEGER, className: "text-right" },
    {
      key: "name",
      header: "Theme",
      render: (t) => (
        <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-zinc-950 hover:text-primary dark:text-zinc-50">
          {t.name}
          {t.isNew && <span className="rounded-full bg-primary-tint px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary-tint-text">New</span>}
          <ExternalLink className="h-3 w-3 text-zinc-400" aria-hidden />
        </a>
      ),
      sortValue: (t) => t.name.toLowerCase(),
    },
    { key: "designer", header: "Designer", render: (t) => (t.designer ? <span>{t.designer}</span> : dash), sortValue: (t) => (t.designer ?? "~").toLowerCase() },
    { key: "price", header: "Price", render: (t) => <span className="tabular-nums">{priceLabel(t.price)}</span>, sortValue: (t) => t.price ?? -1, className: "text-right" },
    { key: "positive", header: "Positive", render: (t) => <span className="tabular-nums">{t.positivePercent === null ? "—" : `${t.positivePercent}%`}</span>, sortValue: (t) => t.positivePercent ?? -1, className: "text-right" },
    { key: "reviews", header: "Reviews", render: (t) => <span className="tabular-nums">{t.reviewCount?.toLocaleString() ?? "—"}</span>, sortValue: (t) => t.reviewCount ?? -1, className: "text-right" },
    { key: "presets", header: "Presets", render: (t) => <span className="tabular-nums">{t.presetCount}</span>, sortValue: (t) => t.presetCount, className: "text-right" },
    {
      key: "categories",
      header: "Categories",
      render: (t) => (t.industries.length ? <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.industries.map(industryLabel).join(", ")}</span> : dash),
    },
    {
      key: "version",
      header: "Latest version",
      render: (t) => (t.latestVersion ? <span className="text-xs tabular-nums">{t.latestVersion}{t.latestVersionReleasedAt ? <span className="text-zinc-500"> · {t.latestVersionReleasedAt}</span> : null}</span> : dash),
      sortValue: (t) => (t.latestVersionReleasedAt ? new Date(t.latestVersionReleasedAt).getTime() || 0 : 0),
    },
    { key: "features", header: "Features", render: (t) => <span className="tabular-nums">{t.features.length || "—"}</span>, sortValue: (t) => t.features.length, className: "text-right" },
  ];

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">All Theme Store themes</h2>
      <p className="max-w-3xl text-sm text-zinc-500">
        Every theme on{" "}
        <a href="https://themes.shopify.com/themes" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          themes.shopify.com
        </a>
        , whoever made it. A refresh reads the catalog, then each category, then each theme&apos;s own page (designer, reviews, version, features) with a short pause between requests, so it takes roughly 10–15 minutes. Theme pages already read in the last
        week are skipped. The # is the theme&apos;s place in the store&apos;s default order.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={startCrawl} disabled={running}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${running ? "animate-spin" : ""}`} aria-hidden />
          {running ? "Reading…" : themes.length > 0 ? "Refresh Theme Store" : "Read Theme Store"}
        </Button>
        <Button type="button" onClick={exportCsv} disabled={shown.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Export CSV
        </Button>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm">
          <option value="">All categories</option>
          {INDUSTRIES.map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.label}
            </option>
          ))}
          <option value="none">No category</option>
        </select>
        <select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price" className="rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm">
          <option value="">Free and paid</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search theme, designer or feature"
          aria-label="Search themes"
          className="min-w-56 rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm"
        />
        {data?.lastCrawledAt && <span className="text-xs text-zinc-500">Last updated {formatDateTime(data.lastCrawledAt)}</span>}
      </div>

      {(startError || error) && <p className="text-sm text-status-fail-text">{startError ?? error}</p>}

      {progress?.running && progress.phase && (
        <div className="max-w-xl">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.phase === "catalog" ? 5 : pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {PHASE_LABEL[progress.phase]}
            {progress.phase === "catalog" ? ` · ${progress.themesSeen.toLocaleString()} cards read` : ` · ${progress.done} of ${progress.total}`}
            {progress.current && progress.phase !== "catalog" ? ` (${progress.current})` : ""}
          </p>
        </div>
      )}
      {progress && !progress.running && progress.errors.length > 0 && (
        <p className="text-xs text-status-fail-text">
          {progress.errors.length} problem{progress.errors.length === 1 ? "" : "s"}: {progress.errors.slice(0, 5).join("; ")}
          {progress.errors.length > 5 ? "…" : ""}
        </p>
      )}

      {!loading && themes.length === 0 ? (
        <EmptyState icon={Store} title="No Theme Store themes yet" description="Press “Read Theme Store” to collect them." />
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {shown.length.toLocaleString()} themes shown
            {(data?.detailsPending ?? 0) > 0 ? ` · ${data!.detailsPending} theme pages not read yet` : ""}
          </p>
          <ResponsiveTable columns={columns} rows={shown} rowKey={(t) => t.slug} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={50} emptyMessage="No themes match." />
        </>
      )}
    </section>
  );
}
