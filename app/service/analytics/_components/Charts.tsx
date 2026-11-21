import Link from "next/link";
import type { ReactNode } from "react";

// Small server-rendered charts for the Analytics tab. One series each in the primary colour (no colour-only meaning: every bar has its
// value in a tooltip and the figures are repeated in the tables beside them); no dual axis; the grid is a single quiet reference line.

export function Panel({ title, note, children, className = "" }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border-subtle bg-surface p-4 ${className}`}>
      <h3 className="font-medium">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-zinc-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  tip: string;
  muted?: boolean;
}

/** Vertical bars over time. `refLine` draws a dashed line at that value (e.g. 100% of capacity). */
export function BarChart({
  items,
  height = 150,
  refLine,
  refLabel,
  ariaLabel,
  every,
}: {
  items: BarItem[];
  height?: number;
  refLine?: number;
  refLabel?: string;
  ariaLabel: string;
  every?: number;
}) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">Nothing in this range.</p>;
  const max = Math.max(1, ...items.map((i) => i.value), refLine ?? 0);
  const step = every ?? Math.max(1, Math.ceil(items.length / 10));
  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {refLine !== undefined && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-400" style={{ bottom: `${(refLine / max) * 100}%` }}>
            {refLabel && <span className="absolute -top-4 right-0 text-[10px] text-zinc-500">{refLabel}</span>}
          </div>
        )}
        {items.map((i, n) => (
          <div key={`${i.label}-${n}`} className="flex h-full min-w-0 flex-1 items-end" title={i.tip}>
            <div
              className={`w-full rounded-t-[4px] ${i.muted ? "bg-zinc-300 dark:bg-zinc-600" : "bg-primary"}`}
              style={{ height: `${Math.max(i.value > 0 ? 2 : 0, (i.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-zinc-500">
        {items.map((i, n) => (
          <div key={`l-${i.label}-${n}`} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {n % step === 0 ? i.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface HRow {
  label: ReactNode;
  sub?: ReactNode;
  value: number;
  display: ReactNode;
  href?: string;
}

/** Ranked horizontal bars: name, bar, figure. */
export function HBars({ rows, empty = "Nothing in this range." }: { rows: HRow[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r, n) => (
        <li key={n} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {r.href ? (
                <Link href={r.href} className="font-medium hover:text-primary hover:underline">
                  {r.label}
                </Link>
              ) : (
                <span className="font-medium">{r.label}</span>
              )}
              {r.sub && <span className="ml-2 text-xs text-zinc-500">{r.sub}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{r.display}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A compact ranked table (rank, name, figures). */
export function RankTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">Nothing in this range.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr className="border-b border-border-subtle text-left">
            <th className="w-6 py-1.5 pr-2 font-medium">#</th>
            {head.map((h, i) => (
              <th key={h} className={`py-1.5 pr-3 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((r, n) => (
            <tr key={n}>
              <td className="py-1.5 pr-2 text-zinc-400 tabular-nums">{n + 1}</td>
              {r.map((c, i) => (
                <td key={i} className={`py-1.5 pr-3 ${i > 0 ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
