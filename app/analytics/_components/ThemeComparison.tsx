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
 * Theme | Try Theme | Installs | Install Rate. Sortable per column (sorting
 * the rows the engine already computed — no maths here). Clicking a theme
 * narrows the whole dashboard to it.
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
      key: "tryTheme",
      header: "Try Theme",
      className: num,
      render: (r) => <Cell value={formatCount(r.current.tryTheme)} change={r.comparison?.tryTheme} />,
      sortValue: (r) => r.current.tryTheme,
    },
    {
      key: "installs",
      header: "Installs",
      className: num,
      render: (r) => <Cell value={`${estimatedInstalls.has(r.theme.id) ? "≈" : ""}${formatCount(r.current.installs)}`} change={r.comparison?.installs} />,
      sortValue: (r) => r.current.installs,
    },
    {
      key: "installRate",
      header: "Install Rate",
      className: num,
      render: (r) => <Cell value={formatPercent(r.current.installRate, 2)} change={r.comparison?.installRate} unit="points" />,
      sortValue: (r) => r.current.installRate ?? -1,
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
