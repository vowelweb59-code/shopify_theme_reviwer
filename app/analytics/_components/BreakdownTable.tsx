"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Filter } from "lucide-react";
import { Button } from "@/app/_components/ui/Button";
import { ErrorState } from "@/app/_components/ui/EmptyState";
import type { AggregateDimension } from "@/lib/analytics/constants";
import { FILTER_PARAMS, breakdownFor, type FilterParam } from "@/lib/analytics/engine/filters";
import type { Change } from "@/lib/analytics/engine/kpis";
import type { BreakdownResponse, BreakdownRow } from "@/lib/analytics/engine/metrics";
import { groupDimsFor, type BreakdownSort } from "@/lib/analytics/engine/params";
import { ChangeBadge } from "./KpiCards";
import { FILTER_LABELS, eventLabel, mergeFilters } from "./FilterBar";
import { formatCount, formatPercent } from "./format";
import { useApi } from "./useApi";
import { useDashboardParams, type DashboardFilters } from "./useDashboardParams";

const PAGE_SIZE = 25;
const PARAM_FOR_DIM = Object.fromEntries(Object.entries(FILTER_PARAMS).map(([p, d]) => [d, p])) as Record<AggregateDimension, FilterParam>;

type Column = {
  key: string;
  header: string;
  sort?: BreakdownSort;
  value: (r: BreakdownRow) => string;
  change?: (r: BreakdownRow) => Change | undefined;
  unit?: "percent" | "points";
};

function rowLabel(row: BreakdownRow, dimension: FilterParam): string {
  if (dimension === "city") return [row.values.city, row.values.country].filter(Boolean).join(", ") || "(not set)";
  return row.values[FILTER_PARAMS[dimension]] || "(not set)";
}

/** The filters that narrow the dashboard to one row. Null when a value is missing. */
function rowFilters(row: BreakdownRow, groupDims: AggregateDimension[]): DashboardFilters | null {
  const out: DashboardFilters = {};
  for (const d of groupDims) {
    const v = row.values[d];
    if (!v) return null;
    out[PARAM_FOR_DIM[d]] = v;
  }
  return out;
}

function FilterAction({
  row,
  dimension,
  groupDims,
  filters,
  onFilter,
}: {
  row: BreakdownRow;
  dimension: FilterParam;
  groupDims: AggregateDimension[];
  filters: DashboardFilters;
  onFilter: (filters: DashboardFilters) => void;
}) {
  const f = rowFilters(row, groupDims);
  if (!f) return null;
  const merged = mergeFilters(filters, f);
  const already = JSON.stringify(merged) === JSON.stringify(filters);
  return (
    <button
      type="button"
      disabled={already}
      onClick={() => onFilter(merged)}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-black/[.04] hover:text-primary disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500 dark:hover:bg-white/[.04]"
      aria-label={`Filter the dashboard to ${rowLabel(row, dimension)}`}
    >
      <Filter className="h-3 w-3" aria-hidden />
      {already ? "Filtered" : "Filter"}
    </button>
  );
}

/**
 * KPIs per value of one dimension (country, device, source, page, ...).
 * Sorting and paging happen server-side, so only one page of rows ever
 * reaches the browser. Each row can become a dashboard-wide filter. When
 * the active filters come from another dimension family the API can't
 * answer, and the table says so instead of requesting.
 */
export function BreakdownTable({ dimension, defaultSort = "users" }: { dimension: FilterParam; defaultSort?: BreakdownSort }) {
  const { params, setParams, apiQuery } = useDashboardParams();
  const [sort, setSort] = useState<{ key: BreakdownSort; order: "asc" | "desc" }>({ key: defaultSort, order: "desc" });
  // The page resets whenever the selection or sort changes (derived, not synced in an effect).
  const pageKey = `${apiQuery}|${sort.key}|${sort.order}`;
  const [page, setPage] = useState({ key: pageKey, offset: 0 });
  const offset = page.key === pageKey ? page.offset : 0;

  const groupDims = groupDimsFor(dimension);
  const filterDims = (Object.keys(params.filters) as FilterParam[]).map((p) => FILTER_PARAMS[p]);
  let incompatible = false;
  try {
    breakdownFor([...filterDims, ...groupDims]);
  } catch {
    incompatible = true;
  }

  const qs = new URLSearchParams(apiQuery);
  qs.set("dimension", dimension);
  qs.set("sort", sort.key);
  qs.set("order", sort.order);
  qs.set("limit", String(PAGE_SIZE));
  qs.set("offset", String(offset));
  const api = useApi<BreakdownResponse>(incompatible ? null : `/api/analytics/metrics/breakdown?${qs}`);

  if (incompatible) {
    const names = (Object.keys(params.filters) as FilterParam[]).map((p) => FILTER_LABELS[p]).join(" + ");
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-subtle p-6 text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          {FILTER_LABELS[dimension]} can&apos;t be broken down while filtering by {names}: they&apos;re stored as separate dimension families, so
          no data carries both.
        </p>
        <Button size="sm" variant="secondary" onClick={() => setParams({ filters: {} })}>
          Remove filters
        </Button>
      </div>
    );
  }

  if (api.error) {
    return (
      <ErrorState
        title="Couldn't load this breakdown"
        description={api.error}
        action={
          <Button size="sm" variant="secondary" onClick={api.reload}>
            Try again
          </Button>
        }
      />
    );
  }

  const columns: Column[] = [
    { key: "users", header: "Users", sort: "users", value: (r) => formatCount(r.current.users), change: (r) => r.comparison?.users },
    { key: "views", header: "Theme Views", sort: "themeViews", value: (r) => formatCount(r.current.themeViews.users), change: (r) => r.comparison?.themeViews.users },
    { key: "try", header: "Try Theme", sort: "tryTheme", value: (r) => formatCount(r.current.tryTheme.users), change: (r) => r.comparison?.tryTheme.users },
    { key: "installs", header: "Installs", sort: "installs", value: (r) => formatCount(r.current.installs.users), change: (r) => r.comparison?.installs.users },
    {
      key: "installRate",
      header: "Install Rate",
      sort: "installRate",
      value: (r) => formatPercent(r.current.rates.installRate, 2),
      change: (r) => r.comparison?.rates.installRate,
      unit: "points",
    },
  ];
  if (params.event) {
    const e = params.event;
    columns.push({
      key: "event",
      header: `${eventLabel(e)} users`,
      value: (r) => formatCount(r.current.events[e]?.users ?? 0),
      change: (r) => r.comparison?.events[e]?.users,
    });
  }

  const data = api.data;
  const rows = data?.rows ?? [];
  const total = data?.totalRows ?? 0;

  function toggleSort(key: BreakdownSort) {
    setSort((s) => (s.key === key ? { key, order: s.order === "desc" ? "asc" : "desc" } : { key, order: "desc" }));
  }

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${data && api.loading ? "opacity-60" : ""}`} aria-busy={api.loading}>
      {!data ? (
        <div className="h-64 animate-pulse rounded-lg border border-border-subtle bg-surface-muted" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle p-6 text-center text-sm text-zinc-500">No data for this selection.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border-subtle sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle bg-primary-tint text-xs uppercase text-primary-tint-text">
                <tr>
                  <th className="px-4 py-3 font-medium">{FILTER_LABELS[dimension]}</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 text-right font-medium" aria-sort={c.sort && sort.key === c.sort ? (sort.order === "asc" ? "ascending" : "descending") : undefined}>
                      {c.sort ? (
                        <button type="button" onClick={() => toggleSort(c.sort!)} className="inline-flex items-center gap-1 uppercase hover:text-zinc-900 dark:hover:text-zinc-100">
                          {c.header}
                          {sort.key === c.sort && (sort.order === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />)}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                  <th className="px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border-subtle last:border-0">
                    <td className="max-w-[18rem] truncate px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100" title={rowLabel(r, dimension)}>
                      {rowLabel(r, dimension)}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-right">
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span className="tabular-nums text-zinc-950 dark:text-zinc-50">{c.value(r)}</span>
                          {c.change && <ChangeBadge change={c.change(r)} unit={c.unit} />}
                        </span>
                      </td>
                    ))}
                    <td className="px-2 py-3 text-right">
                      <FilterAction row={r} dimension={dimension} groupDims={groupDims} filters={params.filters} onFilter={(filters) => setParams({ filters })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {rows.map((r) => (
              <div key={r.key} className="rounded-lg border border-border-subtle p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="break-all font-medium text-zinc-900 dark:text-zinc-100">{rowLabel(r, dimension)}</span>
                  <FilterAction row={r} dimension={dimension} groupDims={groupDims} filters={params.filters} onFilter={(filters) => setParams({ filters })} />
                </div>
                {columns.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3 py-1 text-sm">
                    <span className="text-xs uppercase text-zinc-500">{c.header}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{c.value(r)}</span>
                      {c.change && <ChangeBadge change={c.change(r)} unit={c.unit} />}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {formatCount(total)}
            </span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setPage({ key: pageKey, offset: Math.max(0, offset - PAGE_SIZE) })}
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-black/[.02] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[.03]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setPage({ key: pageKey, offset: offset + PAGE_SIZE })}
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 hover:bg-black/[.02] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[.03]"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>

          {data.meta.warnings.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs text-status-info-text">
              {data.meta.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
