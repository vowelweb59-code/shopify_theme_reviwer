"use client";

import { Download, ExternalLink, Mail, RefreshCw, Star, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { formatDateTime } from "@/app/_components/formatDate";
import { useApi } from "@/app/analytics/_components/useApi";
import { countryFromLocation } from "@/lib/partners/parseDirectory";

type Partner = {
  slug: string;
  name: string;
  url: string;
  rating: number | null;
  reviewCount: number | null;
  location: string | null;
  countrySlugs: string[];
  tier: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  startingPrice: number | null;
  services: string[];
  moreServices: number;
};
type PartnersData = { detailsPending: number; partners: Partner[]; countries: { slug: string; label: string; count: number }[]; lastCrawledAt: string | null };
type DetailsProgress = { running: boolean; total: number; done: number; errors: number; lastError: string | null };
type Progress = { running: boolean; total: number; done: number; current: string | null; partnersSeen: number; errors: string[]; finishedAt: string | null };

const TIER_LABEL: Record<string, string> = { platinum: "Platinum", plus: "Plus", premier: "Premier", select: "Select" };
// Highest tier first when sorting; untiered last.
const TIER_ORDER = ["platinum", "plus", "premier", "select", ""];

export function PotentialAffiliatesTab() {
  const { data, loading, error, reload } = useApi<PartnersData>("/api/partners");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [details, setDetails] = useState<DetailsProgress | null>(null);
  const [country, setCountry] = useState("");
  const [tier, setTier] = useState("");
  const [query, setQuery] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  // Poll while a crawl runs (and once on mount, to pick up one already running).
  const crawling = progress?.running ?? false;
  const reading = details?.running ?? false;
  const running = crawling || reading;
  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const [a, b] = await Promise.all([fetch("/api/partners/crawl"), fetch("/api/partners/details")]);
        if (stop) return;
        if (a.ok) setProgress((await a.json()) as Progress);
        if (b.ok) setDetails((await b.json()) as DetailsProgress);
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
    const res = await fetch("/api/partners/crawl", { method: "POST" });
    if (!res.ok) return setStartError("Couldn't start the collection.");
    setProgress((await res.json()) as Progress);
  }

  async function startDetails() {
    setStartError(null);
    const res = await fetch("/api/partners/details", { method: "POST" });
    if (!res.ok) return setStartError("Couldn't start reading contact details.");
    setDetails((await res.json()) as DetailsProgress);
  }

  const partners = useMemo(() => data?.partners ?? [], [data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return partners.filter(
      (p) =>
        (!country || p.countrySlugs.includes(country)) &&
        (!tier || (tier === "none" ? !p.tier : p.tier === tier)) &&
        (!q || p.name.toLowerCase().includes(q) || (p.location ?? "").toLowerCase().includes(q) || p.services.some((s) => s.toLowerCase().includes(q)) || (p.email ?? "").includes(q) || (p.website ?? "").toLowerCase().includes(q))
    );
  }, [partners, country, tier, query]);

  function exportCsv() {
    const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Partner", "Country", "Tier", "Location", "Rating", "Reviews", "Email", "Phone", "Website", "Profile"];
    const lines = shown.map((p) => [p.name, countryFromLocation(p.location), p.tier ? TIER_LABEL[p.tier] : "", p.location, p.rating, p.reviewCount, p.email, p.phone, p.website, p.url].map(cell).join(","));
    const url = URL.createObjectURL(new Blob([[header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopify-partners.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: TableColumn<Partner>[] = [
    {
      key: "name",
      header: "Partner",
      render: (p) => (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-zinc-950 hover:text-primary dark:text-zinc-50">
          {p.name}
          <ExternalLink className="h-3 w-3 text-zinc-400" aria-hidden />
        </a>
      ),
      sortValue: (p) => p.name.toLowerCase(),
    },
    {
      key: "country",
      header: "Country",
      render: (p) => <span>{countryFromLocation(p.location) ?? "—"}</span>,
      sortValue: (p) => countryFromLocation(p.location) ?? "~",
    },
    {
      key: "tier",
      header: "Tier",
      render: (p) => (p.tier ? <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-tint-text">{TIER_LABEL[p.tier] ?? p.tier}</span> : <span className="text-zinc-400">—</span>),
      sortValue: (p) => TIER_ORDER.indexOf(p.tier ?? ""),
    },
    {
      key: "email",
      header: "Email",
      render: (p) => (p.email ? <a href={`mailto:${p.email}`} className="text-xs hover:text-primary hover:underline">{p.email}</a> : <span className="text-zinc-400">—</span>),
      sortValue: (p) => p.email ?? "~",
    },
    {
      key: "phone",
      header: "Phone",
      render: (p) => (p.phone ? <a href={`tel:${p.phone}`} className="text-xs tabular-nums hover:text-primary hover:underline">{p.phone}</a> : <span className="text-zinc-400">—</span>),
      sortValue: (p) => p.phone ?? "~",
    },
    {
      key: "website",
      header: "Website",
      render: (p) =>
        p.website ? (
          <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-primary hover:underline">
            {p.website.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
      sortValue: (p) => p.website ?? "~",
    },
    { key: "location", header: "Location", render: (p) => <span className="text-zinc-600 dark:text-zinc-400">{p.location ?? "—"}</span>, sortValue: (p) => (p.location ?? "~").toLowerCase() },
    {
      key: "rating",
      header: "Rating",
      render: (p) =>
        p.rating === null ? (
          <span className="text-zinc-400">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star className="h-3.5 w-3.5 fill-status-warning-icon text-status-warning-icon" aria-hidden />
            {p.rating.toFixed(1)}
          </span>
        ),
      sortValue: (p) => p.rating ?? -1,
      className: "text-right",
    },
    { key: "reviews", header: "Reviews", render: (p) => <span className="tabular-nums">{p.reviewCount?.toLocaleString() ?? "—"}</span>, sortValue: (p) => p.reviewCount ?? -1, className: "text-right" },
    {
      key: "price",
      header: "From",
      render: (p) => <span className="tabular-nums">{p.startingPrice === null ? "—" : `$${p.startingPrice.toLocaleString()}`}</span>,
      sortValue: (p) => p.startingPrice ?? Number.MAX_SAFE_INTEGER,
      className: "text-right",
    },
    {
      key: "services",
      header: "Services",
      render: (p) => (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {p.services.join(", ")}
          {p.moreServices > 0 && <span className="text-zinc-400"> +{p.moreServices} more</span>}
        </span>
      ),
    },
  ];

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Shopify partners from the public{" "}
        <a href="https://www.shopify.com/partners/directory" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          Partner Directory
        </a>
        , collected country by country as a pool of potential affiliates. A refresh reads about 700 directory pages (the partners, then one pass per tier) with a short pause between them, so it takes roughly 15 minutes. Contact details (email, phone, website) are on each partner’s own profile page, so they are a separate step: about one request per partner, roughly two hours for everyone, and it picks up where it stopped.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={startCrawl} disabled={running}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${running ? "animate-spin" : ""}`} aria-hidden />
          {crawling ? "Collecting…" : partners.length > 0 ? "Refresh partners" : "Collect partners"}
        </Button>
        <Button type="button" onClick={startDetails} disabled={running || (data?.detailsPending ?? 0) === 0}>
          <Mail className={`mr-1.5 h-4 w-4 ${reading ? "animate-pulse" : ""}`} aria-hidden />
          {reading ? "Reading contact details…" : `Collect contact details (${(data?.detailsPending ?? 0).toLocaleString()} left)`}
        </Button>
        <Button type="button" onClick={exportCsv} disabled={shown.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Export CSV
        </Button>
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm">
          <option value="">All countries ({partners.length})</option>
          {(data?.countries ?? []).map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Tier" className="rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm">
          <option value="">All tiers</option>
          {Object.entries(TIER_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
          <option value="none">No tier</option>
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, city or service"
          aria-label="Search partners"
          className="min-w-56 rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm"
        />
        {data?.lastCrawledAt && <span className="text-xs text-zinc-500">Last updated {formatDateTime(data.lastCrawledAt)}</span>}
      </div>

      {(startError || error) && <p className="text-sm text-status-fail-text">{startError ?? error}</p>}

      {progress?.running && (
        <div className="max-w-xl">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Country {Math.min(progress.done + 1, progress.total)} of {progress.total}
            {progress.current ? ` (${progress.current})` : ""} · {progress.partnersSeen.toLocaleString()} partners read
          </p>
        </div>
      )}
      {details?.running && (
        <p className="text-xs text-zinc-500">
          Reading profiles: {details.done.toLocaleString()} of {details.total.toLocaleString()} (about 1 per 1.5 s, highest-reviewed first; safe to leave and come back — it resumes where it stopped).
          {details.errors > 0 ? ` ${details.errors} failed.` : ""}
        </p>
      )}
      {details && !details.running && details.lastError && <p className="text-xs text-status-fail-text">Contact details stopped: {details.lastError}</p>}
      {progress && !progress.running && progress.errors.length > 0 && <p className="text-xs text-status-fail-text">Some countries failed: {progress.errors.join("; ")}</p>}

      {!loading && partners.length === 0 ? (
        <EmptyState icon={Users} title="No partners yet" description="Press “Collect partners” to read the directory." />
      ) : (
        <>
          <p className="text-xs text-zinc-500">{shown.length.toLocaleString()} partners shown</p>
          <ResponsiveTable columns={columns} rows={shown} rowKey={(p) => p.slug} pageSize={50} emptyMessage="No partners match." />
        </>
      )}
    </div>
  );
}
