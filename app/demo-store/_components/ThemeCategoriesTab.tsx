"use client";

import { Store } from "lucide-react";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { useApi } from "@/app/analytics/_components/useApi";
import { industryLabel } from "@/lib/themes/industries";
import { ThemeStoreCatalogSection } from "./ThemeStoreCatalogSection";

type ThemeRow = { themeId: string; themeName: string; category: string | null; publisher: string | null };
type CategoryRow = { category: string | null; themes: string[] };

export function ThemeCategoriesTab() {
  const { data, loading, error } = useApi<{ themes: ThemeRow[] }>("/api/theme-categories");
  const themes: ThemeRow[] = data?.themes ?? [];

  const byCategory = new Map<string | null, string[]>();
  for (const t of themes) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t.themeName]);
  const categories: CategoryRow[] = [...byCategory].map(([category, names]) => ({ category, themes: names.sort((a, b) => a.localeCompare(b)) }));

  const themeColumns: TableColumn<ThemeRow>[] = [
    { key: "theme", header: "Theme", render: (r) => <span className="font-medium text-zinc-950 dark:text-zinc-50">{r.themeName}</span>, sortValue: (r) => r.themeName.toLowerCase() },
    { key: "publisher", header: "Publisher", render: (r) => (r.publisher ? <span>{r.publisher}</span> : <span className="text-zinc-400">—</span>), sortValue: (r) => (r.publisher ?? "~").toLowerCase() },
    {
      key: "category",
      header: "Category",
      render: (r) => <span className={r.category ? undefined : "italic text-zinc-500"}>{industryLabel(r.category)}</span>,
      sortValue: (r) => industryLabel(r.category),
    },
  ];

  const categoryColumns: TableColumn<CategoryRow>[] = [
    {
      key: "category",
      header: "Category",
      render: (r) => <span className={r.category ? "font-medium" : "italic text-zinc-500"}>{industryLabel(r.category)}</span>,
      sortValue: (r) => industryLabel(r.category),
    },
    { key: "count", header: "Themes", render: (r) => <span className="tabular-nums">{r.themes.length}</span>, sortValue: (r) => r.themes.length, className: "text-right" },
    { key: "names", header: "Which themes", render: (r) => <span className="text-zinc-600 dark:text-zinc-400">{r.themes.join(", ")}</span> },
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

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Themes</h3>
              <ResponsiveTable columns={themeColumns} rows={themes} rowKey={(r) => r.themeId} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={30} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
