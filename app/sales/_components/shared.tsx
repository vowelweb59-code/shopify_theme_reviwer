"use client";

import type { ReactNode } from "react";

// Types mirror lib/sales/aggregate.ts's SalesSummary (JSON over the wire).
export type Metrics = { sales: number; refunds: number; netSales: number; gross: number; net: number };
export type MonthMatrixRow = { key: string; label: string; total: Metrics; byMonth: Record<string, Metrics> };
export type SalesSummary = {
  months: string[];
  totals: Metrics & { tryTheme: number | null; installs: number | null };
  themeMonths: (Metrics & { themeId: string; themeName: string; month: string; tryTheme: number | null; installs: number | null; saleRate: number | null })[];
  themes: (Metrics & { themeId: string; themeName: string; tryTheme: number | null; installs: number | null; saleRate: number | null })[];
  presets: (Metrics & { themeId: string; themeName: string; preset: string; category: string | null; stores: number })[];
  presetMonths: MonthMatrixRow[];
  categories: (Metrics & { category: string | null; presets: string[] })[];
  categoryMonths: MonthMatrixRow[];
  countries: (Metrics & { country: string })[];
  themesWithSales: { themeId: string; themeName: string }[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : count.format(value);
}

export function formatRate(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

/** "2026-07" -> "Jul 2026". */
export function formatMonth(month: string, short = false): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", year: short ? "2-digit" : "numeric", timeZone: "UTC" });
}

export function shareOf(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
}

export function SectionTitle({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Net sales (sales minus refunds); refunds shown underneath when there are any. */
export function SalesCell({ m }: { m: Metrics }) {
  return (
    <span className="tabular-nums">
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCount(m.netSales)}</span>
      {m.refunds > 0 && <span className="ml-1 text-xs text-zinc-500">({m.refunds} refund{m.refunds > 1 ? "s" : ""})</span>}
    </span>
  );
}

/**
 * Rows × months grid of net sales, newest month on the left — the "which
 * month had how many sales" view. Scrolls sideways on narrow screens with
 * the row label pinned.
 */
export function MonthMatrix({ rows, months, rowHeader, emptyMessage }: { rows: MonthMatrixRow[]; months: string[]; rowHeader: string; emptyMessage: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  const cols = [...months].reverse();
  const monthTotals = cols.map((m) => rows.reduce((n, r) => n + (r.byMonth[m]?.netSales ?? 0), 0));
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((m) => r.byMonth[m]?.netSales ?? 0)));
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface-muted px-3 py-2 text-left font-medium">{rowHeader}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
            {cols.map((m) => (
              <th key={m} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">
                {formatMonth(m, true)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border-subtle">
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2 text-left font-medium text-zinc-800 dark:text-zinc-200">
                {r.label}
              </th>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCount(r.total.netSales)}</td>
              {cols.map((m) => {
                const v = r.byMonth[m]?.netSales ?? 0;
                return (
                  <td
                    key={m}
                    className="px-3 py-2 text-right tabular-nums"
                    style={v > 0 ? { backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round((v / max) * 28) + 4}%, transparent)` } : undefined}
                    title={r.byMonth[m] ? `${r.label}, ${formatMonth(m)}: ${r.byMonth[m].sales} sold, ${r.byMonth[m].refunds} refunded, ${formatMoney(r.byMonth[m].gross)}` : undefined}
                  >
                    {v === 0 ? <span className="text-zinc-300 dark:text-zinc-600">·</span> : v}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-border-strong bg-surface-muted font-semibold">
            <th scope="row" className="sticky left-0 z-10 bg-surface-muted px-3 py-2 text-left">All</th>
            <td className="px-3 py-2 text-right tabular-nums">{formatCount(rows.reduce((n, r) => n + r.total.netSales, 0))}</td>
            {monthTotals.map((v, i) => (
              <td key={cols[i]} className="px-3 py-2 text-right tabular-nums">
                {v}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}
