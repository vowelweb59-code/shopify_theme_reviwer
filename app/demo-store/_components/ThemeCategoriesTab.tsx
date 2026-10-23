"use client";

import { Store } from "lucide-react";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { useApi } from "@/app/analytics/_components/useApi";
import { INDUSTRIES, industryLabel } from "@/lib/themes/industries";
import { ThemeStoreCatalogSection } from "./ThemeStoreCatalogSection";

type ThemeRow = { themeId: string; themeName: string; category: string | null; publisher: string | null; publisherThemes: number | null };
type StoreListing = { name: string; industries: string[]; rank: number | null };
type CategoryRow = { category: string | null; themes: string[]; storeThemes: string[] };

export function ThemeCategoriesTab() {
  const { data, loading, error } = useApi<{ themes: ThemeRow[] }>("/api/theme-categories");
  const themes: ThemeRow[] = data?.themes ?? [];
  const { data: store } = useApi<{ themes: StoreListing[] }>("/api/theme-store");
  const storeListings = store?.themes ?? [];

  // Every Theme Store category is listed, with 0 where you have no theme in it; themes with no category aren't shown.
  const byCategory = new Map<string | null, string[]>(INDUSTRIES.map((i) => [i.slug, []]));
  for (const t of themes) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t.themeName]);
  const categories: CategoryRow[] = [...byCategory]
    .filter(([category]) => category !== null)
    .map(([category, names]) => ({
      category,
      themes: names.sort((a, b) => a.localeCompare(b)),
      // Main Theme Store themes whose own (default) card is listed under this category, in the store's own order. A theme in several categories is a leftover of an older crawl that counted presets, so it isn't trusted here.
      storeThemes: storeListings
        .filter((s) => (category === null ? s.industries.length === 0 : s.industries.length === 1 && s.industries[0] === category))
        .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
        .map((s) => s.name),
    }))
    .sort((a, b) => b.themes.length - a.themes.length || industryLabel(a.category).localeCompare(industryLabel(b.category)));

  const categoryColumns: TableColumn<CategoryRow>[] = [
    {
      key: "category",
      header: "Category",
      render: (r) => <span className={r.category ? "font-medium" : "italic text-zinc-500"}>{industryLabel(r.category)}</span>,
      sortValue: (r) => industryLabel(r.category),
    },
    { key: "count", header: "Themes", render: (r) => <span className="tabular-nums">{r.themes.length}</span>, sortValue: (r) => r.themes.length, className: "text-right" },
    { key: "names", header: "Which themes", render: (r) => (r.themes.length ? <span className="text-zinc-600 dark:text-zinc-400">{r.themes.join(", ")}</span> : <span className="text-zinc-400">—</span>) },
    { key: "storeCount", header: "On the Theme Store", render: (r) => <span className="tabular-nums">{r.storeThemes.length.toLocaleString()}</span>, sortValue: (r) => r.storeThemes.length, className: "text-right" },
    {
      key: "storeNames",
      header: "Theme Store themes",
      render: (r) =>
        r.storeThemes.length ? (
          <details className="text-xs text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer text-primary">Show {r.storeThemes.length.toLocaleString()}</summary>
            <p className="mt-1 max-w-xl">{r.storeThemes.join(", ")}</p>
          </details>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ThemeStoreCatalogSection />

      <div className="flex flex-col gap-8">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Your themes by category</h2>
        {loading && !data ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-status-fail-text">{error}</p>
        ) : themes.length === 0 ? (
          <EmptyState icon={Store} title="No themes yet" description="Add a theme in the Themes tab first." />
        ) : (
          <>
            <p className="max-w-2xl text-sm text-zinc-500">
              Each main theme with its publisher and the one Theme Store category its main preset belongs to — the one chosen by hand on the Sales page&apos;s Categories tab, or where the
              store lists the theme&apos;s default preset. Presets aren&apos;t listed here.
            </p>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Themes per category</h3>
              <ResponsiveTable columns={categoryColumns} rows={categories} rowKey={(r) => r.category ?? "none"} theadClassName="bg-primary-tint text-primary-tint-text" />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
