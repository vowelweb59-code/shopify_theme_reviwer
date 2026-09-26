"use client";

import { ResponsiveTable, type TableColumn } from "@/app/_components/ui/Table";
import type { Change } from "@/lib/analytics/engine/kpis";
import type { ThemeKpiRow } from "@/lib/analytics/engine/metrics";
import { ChangeBadge } from "./KpiCards";
import { formatCount, formatPercent } from "./format";

function Cell({ value, change, unit }: { value: string; change?: Change; unit?: "percent" | "points" }) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="font-medium tabular-nums text-zinc-950 dark:text-zinc-50">{value}</span>
      <ChangeBadge change={change} unit={unit} />
    </span>
  );
}

/**
 * Theme | Users | Views | Try Theme | Installs | Install Rate. Sortable per
 * column (sorting the rows the engine already computed — no maths here).
 * Clicking a theme narrows the whole dashboard to it.
 */
export function ThemeComparison({
  rows,
  estimatedInstalls = new Set(),
  onSelect,
}: {
  rows: ThemeKpiRow[];
  /** Theme ids whose installs are estimates (shared GA4 property); shown with "≈". */
  estimatedInstalls?: ReadonlySet<string>;
  onSelect: (slug: string) => void;
}) {
  const num = "text-right";
  const columns: TableColumn<ThemeKpiRow>[] = [
    {
      key: "theme",
      header: "Theme",
      render: (r) => <span className="font-semibold text-primary">{r.theme.name}</span>,
      sortValue: (r) => r.theme.name,
    },
    {
      key: "users",
      header: "Users",
      className: num,
      render: (r) => <Cell value={formatCount(r.current.users)} change={r.comparison?.users} />,
      sortValue: (r) => r.current.users,
    },
    {
      key: "views",
      header: "Views",
      className: num,
      render: (r) => <Cell value={formatCount(r.current.themeViews.users)} change={r.comparison?.themeViews.users} />,
      sortValue: (r) => r.current.themeViews.users,
    },
    {
      key: "tryTheme",
      header: "Try Theme",
      className: num,
      render: (r) => <Cell value={formatCount(r.current.tryTheme.users)} change={r.comparison?.tryTheme.users} />,
      sortValue: (r) => r.current.tryTheme.users,
    },
    {
      key: "installs",
      header: "Installs",
      className: num,
      render: (r) => <Cell value={`${estimatedInstalls.has(r.theme.id) ? "≈" : ""}${formatCount(r.current.installs.users)}`} change={r.comparison?.installs.users} />,
      sortValue: (r) => r.current.installs.users,
    },
    {
      key: "installRate",
      header: "Install Rate",
      className: num,
      render: (r) => <Cell value={formatPercent(r.current.rates.installRate, 2)} change={r.comparison?.rates.installRate} unit="points" />,
      sortValue: (r) => r.current.rates.installRate ?? -1,
    },
  ];

  return (
    <ResponsiveTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.theme.id}
      onRowClick={(r) => onSelect(r.theme.slug)}
      emptyMessage="No themes are connected to GA4 yet."
      theadClassName="bg-primary-tint text-primary-tint-text"
    />
  );
}
