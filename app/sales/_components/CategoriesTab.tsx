"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { useApi } from "@/app/analytics/_components/useApi";
import { INDUSTRIES, industryLabel } from "@/lib/themes/industries";
import { MonthMatrix, SalesCell, SectionTitle, formatMoney, shareOf, type SalesSummary } from "./shared";

type CategoryRow = SalesSummary["categories"][number];
type PresetCategory = {
  themeId: string;
  themeName: string;
  presetName: string;
  listedIn: { industry: string; rank: number }[];
  suggested: string | null;
  manual: string | null;
  category: string | null;
};
export type CrawlProgress = { running: boolean; total: number; done: number; current: string | null; errors: string[] };

export function CategoriesTab({
  data,
  themeId,
  crawl,
  onChanged,
  onStartCrawl,
}: {
  data: SalesSummary;
  themeId: string;
  crawl: CrawlProgress | null;
  onChanged: () => void;
  onStartCrawl: () => void;
}) {
  const mapping = useApi<{ presets: PresetCategory[] }>(`/api/sales/categories${themeId ? `?themeId=${themeId}` : ""}`);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = data.totals.netSales;
  // Only themes that have sales are worth mapping here.
  const withSales = new Set(data.themesWithSales.map((t) => t.themeId));
  const presets = (mapping.data?.presets ?? []).filter((p) => withSales.has(p.themeId));

  async function setCategory(p: PresetCategory, industry: string) {
    setSaving(`${p.themeId}|${p.presetName}`);
    setError(null);
    try {
      const res = await fetch("/api/sales/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: p.themeId, presetName: p.presetName, industry: industry || null }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save.");
      mapping.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(null);
    }
  }

  const columns: TableColumn<CategoryRow>[] = [
    { key: "category", header: "Category", render: (r) => <span className={r.category ? "font-medium" : "italic text-zinc-500"}>{industryLabel(r.category)}</span>, sortValue: (r) => industryLabel(r.category) },
    { key: "presets", header: "Presets", render: (r) => <span className="text-zinc-600 dark:text-zinc-400">{r.presets.join(", ")}</span> },
    { key: "sales", header: "Sales", render: (r) => <SalesCell m={r} />, sortValue: (r) => r.netSales, className: "text-right" },
    { key: "share", header: "Share of sales", render: (r) => <span className="tabular-nums">{shareOf(r.netSales, total)}</span>, sortValue: (r) => r.netSales, className: "text-right" },
    { key: "gross", header: "Revenue", render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span>, sortValue: (r) => r.gross, className: "text-right" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionTitle title="Sales by category" description="Each preset counts under its one main category (set below)." />
        <ResponsiveTable columns={columns} rows={data.categories} rowKey={(r) => r.category ?? "none"} emptyMessage="No sales imported yet." />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title="Categories by month" description="Net sales per category each month." />
        <MonthMatrix rows={data.categoryMonths} months={data.months} rowHeader="Category" emptyMessage="No sales in these months." />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Preset categories"
          description="Suggested from the Theme Store: the category listing where the preset ranks best (same data as the Theme ranking tab). Pick another to override."
          action={
            <Button variant="secondary" size="sm" onClick={onStartCrawl} loading={crawl?.running}>
              {!crawl?.running && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              {crawl?.running ? `Checking categories ${crawl.done}/${crawl.total || "…"}` : "Refresh from Theme Store"}
            </Button>
          }
        />
        {crawl?.running && crawl.current && <p className="text-xs text-zinc-500">Crawling {industryLabel(crawl.current)} — this takes a few minutes; the page updates when it finishes.</p>}
        {crawl && !crawl.running && crawl.errors.length > 0 && <p className="text-xs text-status-warning-text">Some categories couldn&apos;t be checked: {crawl.errors.join("; ")}</p>}
        {error && <p className="text-sm text-status-fail-text">{error}</p>}
        <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Preset</th>
                <th className="px-3 py-2 font-medium">Listed in (rank)</th>
                <th className="px-3 py-2 font-medium">Main category</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => {
                const key = `${p.themeId}|${p.presetName}`;
                return (
                  <tr key={key} className="border-t border-border-subtle align-top">
                    <td className="px-3 py-2 font-medium">
                      {p.presetName}
                      {withSales.size > 1 && <span className="ml-1 text-xs font-normal text-zinc-500">{p.themeName}</span>}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {p.listedIn.length === 0 ? <span className="italic text-zinc-500">Not found yet — refresh</span> : p.listedIn.map((l) => `${industryLabel(l.industry)} (#${l.rank})`).join(", ")}
                    </td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`cat-${key}`}>Main category for {p.presetName}</label>
                      <select
                        id={`cat-${key}`}
                        value={p.manual ?? ""}
                        disabled={saving === key}
                        onChange={(e) => setCategory(p, e.target.value)}
                        className="rounded-md border border-border-strong bg-surface px-2 py-1 text-sm"
                      >
                        <option value="">{p.suggested ? `Suggested: ${industryLabel(p.suggested)}` : "No suggestion yet"}</option>
                        {INDUSTRIES.map((i) => (
                          <option key={i.slug} value={i.slug}>
                            {i.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {presets.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-zinc-500">
                    {mapping.loading ? "Loading…" : "Import sales first."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
