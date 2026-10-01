"use client";

import { Store } from "lucide-react";
import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import { EmptyState } from "@/app/_components/ui/EmptyState";
import { useApi } from "@/app/analytics/_components/useApi";
import { industryLabel } from "@/lib/themes/industries";

type PresetCategory = { themeId: string; themeName: string; presetName: string; category: string | null };
type ThemeRow = { themeId: string; themeName: string; category: string | null };
type CategoryRow = { category: string | null; themes: string[] };

export function ThemeCategoriesTab() {
  const { data, loading, error } = useApi<{ presets: PresetCategory[] }>("/api/sales/categories");

  // The API lists each theme's presets with the base theme's own preset first,
  // so the first row per theme is the main theme — its category is the theme's.
  const themes: ThemeRow[] = [];
  const seen = new Set<string>();
  for (const p of data?.presets ?? []) {
    if (seen.has(p.themeId)) continue;
    seen.add(p.themeId);
    themes.push({ themeId: p.themeId, themeName: p.themeName, category: p.category });
  }

  const byCategory = new Map<string | null, string[]>();
  for (const t of themes) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t.themeName]);
  const categories: CategoryRow[] = [...byCategory].map(([category, names]) => ({ category, themes: names.sort((a, b) => a.localeCompare(b)) }));

  const themeColumns: TableColumn<ThemeRow>[] = [
    { key: "theme", header: "Theme", render: (r) => <span className="font-medium text-zinc-950 dark:text-zinc-50">{r.themeName}</span>, sortValue: (r) => r.themeName.toLowerCase() },
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

  if (loading && !data) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (error) return <p className="text-sm text-status-fail-text">{error}</p>;
  if (themes.length === 0) return <EmptyState icon={Store} title="No themes yet" description="Add a theme in the Themes tab first." />;

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-2xl text-sm text-zinc-500">
        Each main theme and the Theme Store category it belongs to — the category its default preset ranks best in, or the one chosen by hand on the Sales page&apos;s Categories tab. Presets
        aren&apos;t listed here.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Themes per category</h2>
        <ResponsiveTable columns={categoryColumns} rows={categories} rowKey={(r) => r.category ?? "none"} theadClassName="bg-primary-tint text-primary-tint-text" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Themes</h2>
        <ResponsiveTable columns={themeColumns} rows={themes} rowKey={(r) => r.themeId} theadClassName="bg-primary-tint text-primary-tint-text" pageSize={30} />
      </section>
    </div>
  );
}
