"use client";

import { Download, ExternalLink, Puzzle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";

type CompanionApp = { name: string; subtitle: string | null; url: string; pricing: string | null };
type StoreTheme = { slug: string; name: string; url: string; designer: string | null; rank: number | null; companionApp: CompanionApp | null; companionAppChecked: boolean };
type StoreData = { themes: StoreTheme[] };
type AppRow = CompanionApp & { themes: StoreTheme[] };

const dash = <span className="text-zinc-400">—</span>;

export function SuggestedAppsTab() {
  const { data, loading, error } = useApi<StoreData>("/api/theme-store");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"with" | "all">("with");

  const themes = useMemo(() => data?.themes ?? [], [data]);
  const checked = themes.filter((t) => t.companionAppChecked).length;
  const withApp = useMemo(() => themes.filter((t) => t.companionApp), [themes]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (show === "with" ? withApp : themes).filter((t) => !q || t.name.toLowerCase().includes(q) || (t.designer ?? "").toLowerCase().includes(q) || (t.companionApp?.name ?? "").toLowerCase().includes(q));
  }, [themes, withApp, query, show]);

  // The same app is often suggested by several of one developer's themes.
  const apps = useMemo<AppRow[]>(() => {
    const byUrl = new Map<string, AppRow>();
    for (const t of withApp) {
      const app = t.companionApp!;
      const row = byUrl.get(app.url) ?? { ...app, themes: [] };
      row.themes.push(t);
      byUrl.set(app.url, row);
    }
    return [...byUrl.values()].sort((a, b) => b.themes.length - a.themes.length || a.name.localeCompare(b.name));
  }, [withApp]);

  function exportCsv() {
    const cell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((t) => [t.name, t.designer, t.companionApp?.name, t.companionApp?.subtitle, t.companionApp?.pricing, t.companionApp?.url, t.url].map(cell).join(","));
    const header = ["Theme", "Publisher", "Suggested app", "App tagline", "App pricing", "App link", "Theme link"];
    const url = URL.createObjectURL(new Blob([[header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopify-theme-store-suggested-apps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-zinc-950 hover:text-primary dark:text-zinc-50">
      {label}
      <ExternalLink className="h-3 w-3 text-zinc-400" aria-hidden />
    </a>
  );

  const columns: TableColumn<StoreTheme>[] = [
    { key: "rank", header: "#", render: (t) => <span className="tabular-nums text-zinc-500">{t.rank ?? "—"}</span>, sortValue: (t) => t.rank ?? Number.MAX_SAFE_INTEGER, className: "text-right" },
    { key: "theme", header: "Theme", render: (t) => link(t.url, t.name), sortValue: (t) => t.name.toLowerCase() },
    { key: "designer", header: "Publisher", render: (t) => (t.designer ? <span>{t.designer}</span> : dash), sortValue: (t) => (t.designer ?? "~").toLowerCase() },
    {
      key: "app",
      header: "Suggested app",
      render: (t) => (t.companionApp ? link(t.companionApp.url, t.companionApp.name) : <span className="text-zinc-400">{t.companionAppChecked ? "None suggested" : "Not read yet"}</span>),
      sortValue: (t) => (t.companionApp?.name ?? "~").toLowerCase(),
    },
    { key: "tagline", header: "What it does", render: (t) => (t.companionApp?.subtitle ? <span className="text-xs text-zinc-600 dark:text-zinc-400">{t.companionApp.subtitle}</span> : dash) },
    { key: "pricing", header: "App pricing", render: (t) => (t.companionApp?.pricing ? <span className="text-xs">{t.companionApp.pricing}</span> : dash) },
  ];

  const appColumns: TableColumn<AppRow>[] = [
    { key: "app", header: "App", render: (a) => link(a.url, a.name), sortValue: (a) => a.name.toLowerCase() },
    { key: "count", header: "Themes", render: (a) => <span className="tabular-nums">{a.themes.length}</span>, sortValue: (a) => a.themes.length, className: "text-right" },
    { key: "themes", header: "Which themes", render: (a) => <span className="text-xs text-zinc-600 dark:text-zinc-400">{a.themes.map((t) => t.name).join(", ")}</span> },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Apps suggested by Theme Store themes</h2>
      <p className="max-w-3xl text-sm text-zinc-500">
        Some theme pages on themes.shopify.com show a &ldquo;More for your store. Made for your theme.&rdquo; section with an app from the theme&apos;s own developer. This maps every Theme Store theme to that
        app. It is filled by <strong>Refresh Theme Store</strong> in the Theme Categories tab, so themes added to the store later appear (and get checked) on the next refresh.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Export CSV
        </Button>
        <select value={show} onChange={(e) => setShow(e.target.value as "with" | "all")} aria-label="Which themes" className="rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm">
          <option value="with">Themes with a suggested app</option>
          <option value="all">All themes</option>
        </select>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search theme, publisher or app" aria-label="Search" className="min-w-56 rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm" />
      </div>

      {error && <p className="text-sm text-status-fail-text">{error}</p>}

      {!loading && themes.length === 0 ? (
        <EmptyState icon={Puzzle} title="No Theme Store themes yet" description="Open the Theme Categories tab and press “Read Theme Store”." />
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {withApp.length.toLocaleString()} of {themes.length.toLocaleString()} themes suggest an app · {apps.length.toLocaleString()} different apps · {checked.toLocaleString()} theme pages checked
            {checked < themes.length ? ` (${(themes.length - checked).toLocaleString()} still to read — refresh the Theme Store)` : ""}
          </p>
          <ResponsiveTable columns={columns} rows={rows} rowKey={(t) => t.slug} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={50} emptyMessage="No themes match." />

          {apps.length > 0 && (
            <section className="mt-6 flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Themes per suggested app</h3>
              <ResponsiveTable columns={appColumns} rows={apps} rowKey={(a) => a.url} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={25} />
            </section>
          )}
        </>
      )}
    </section>
  );
}
