import Link from "next/link";
import type { ReactNode } from "react";
import { compare, type ClientLine } from "@/lib/service/revenue/compare";
import type { AppClient, HoursRow, TakenRow } from "@/lib/service/revenue/compare";
import { fmtUsd } from "@/lib/service/ui/format";

// Revenue tab (owner, 2026-11-17): money actually taken from clients (the sales sheet, imported by scripts/import-revenue-sheet.ts)
// against what the reported hours were worth. "Should have taken" = reported hours x the project's hourly rate (a fixed project with no
// rate: $15/h; a project with no rate is not priced). Same dashboard look as the Projects tab.

const RANGES = [
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "This year" },
  { id: "all", label: "All time" },
] as const;

const usd = (cents: number) => fmtUsd(Math.round(cents)).replace(/\.00$/, "");
const signed = (cents: number) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${usd(Math.abs(cents))}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const shift = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return d.toISOString().slice(0, 7); };
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function Kpi({ label, value, note, accent }: { label: string; value: ReactNode; note?: ReactNode; accent: string }) {
  return (
    <div className={`rounded-lg border border-l-4 border-border-subtle ${accent} bg-surface p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

/** Taken vs should have taken as two stacked thin bars on the same scale. */
function Bars({ taken, should, max }: { taken: number; should: number; max: number }) {
  const w = (v: number) => `${max > 0 ? Math.min(100, (Math.max(v, 0) / max) * 100) : 0}%`;
  return (
    <div className="w-40 space-y-1" aria-hidden="true">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-status-pass-icon" style={{ width: w(taken) }} /></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-primary" style={{ width: w(should) }} /></div>
    </div>
  );
}

const Diff = ({ cents }: { cents: number }) => (
  <span className={`tabular-nums ${cents < 0 ? "text-status-fail-text" : cents > 0 ? "text-status-pass-text" : "text-zinc-500"}`}>{signed(cents)}</span>
);

function ClientRows({ rows }: { rows: ClientLine[] }) {
  return (
    <>
      {rows.map((c) => (
        <tr key={c.clientId} className="hover:bg-surface-muted/50">
          <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{c.name}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{usd(c.takenCents)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{usd(c.shouldCents)}{c.unpricedHours > 0 && <span className="ml-1 text-xs text-status-warning-text" title={`${c.unpricedHours.toFixed(1)} hours have no rate and are not priced`}>*</span>}</td>
          <td className="px-4 py-2.5 text-right"><Diff cents={c.takenCents - c.shouldCents} /></td>
          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{pct(c.takenCents, c.shouldCents)}</td>
        </tr>
      ))}
    </>
  );
}

export function RevenueView({ input, rangeId }: { input: { taken: TakenRow[]; clients: AppClient[]; hours: HoursRow[] }; rangeId?: string }) {
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[0];
  if (!input.taken.length) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-sm text-zinc-600 dark:text-zinc-400">
        No money-taken data has been imported yet. Import the sales sheet with <code>scripts/import-revenue-sheet.ts</code>, then reload this page.
      </div>
    );
  }
  const last = input.taken.reduce((m, t) => (t.month > m ? t.month : m), "0000-00");
  const first = input.taken.reduce((m, t) => (t.month < m ? t.month : m), "9999-99");
  const from = range.id === "12m" ? shift(last, -11) : range.id === "ytd" ? `${last.slice(0, 4)}-01` : first;
  const out = compare(input.taken, input.clients, input.hours, from, last);

  const taken = out.months.reduce((n, m) => n + m.takenCents, 0);
  const should = out.months.reduce((n, m) => n + m.shouldCents, 0);
  const unpriced = out.months.reduce((n, m) => n + m.unpricedHours, 0);
  const sheetOnly = out.sheetOnly.reduce((n, s) => n + s.cents, 0);
  const max = Math.max(1, ...out.months.flatMap((m) => [m.takenCents, m.shouldCents]));
  const gap = taken - should;
  const under = out.clients.filter((c) => c.takenCents < c.shouldCents).slice(0, 10);
  const over = [...out.clients].filter((c) => c.takenCents > c.shouldCents).reverse().slice(0, 10);
  const th = "px-4 py-2.5 font-medium";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Revenue: taken vs should have taken</h2>
          <p className="text-sm text-zinc-500">{monthLabel(from)} to {monthLabel(last)}. Money from the sales sheet; should-have-taken is the reported hours × rate.</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-border-subtle">
          {RANGES.map((r) => (
            <Link key={r.id} href={r.id === "12m" ? "/service/revenue" : `/service/revenue?range=${r.id}`} aria-current={r.id === range.id ? "page" : undefined}
              className={`border-r border-border-subtle px-3 py-1.5 text-sm last:border-r-0 ${r.id === range.id ? "bg-primary-tint font-medium text-primary-tint-text" : "bg-surface text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi accent="border-l-status-pass-icon" label="Money taken" value={usd(taken)} note="from the sales sheet" />
        <Kpi accent="border-l-primary" label="Should have taken" value={usd(should)} note={`${out.months.reduce((n, m) => n + m.hours, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} hours reported × rate`} />
        <Kpi accent={gap < 0 ? "border-l-status-fail-icon" : "border-l-status-info-icon"} label={gap < 0 ? "Short by" : "Ahead by"} value={usd(Math.abs(gap))} note={`taken is ${pct(taken, should)} of should`} />
        <Kpi accent="border-l-status-warning-icon" label="Taken, not in the app" value={usd(sheetOnly)} note={`${out.sheetOnly.length} sheet clients with no project here`} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className={th}>Month</th>
              <th className={`${th} text-right`}>Taken</th>
              <th className={`${th} text-right`}>Should have taken</th>
              <th className={`${th} text-right`}>Difference</th>
              <th className={`${th} text-right`}>Taken %</th>
              <th className={th}><span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-status-pass-icon" />taken</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />should</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {[...out.months].reverse().map((m) => (
              <tr key={m.month} className="hover:bg-surface-muted/50">
                <td className="px-4 py-2.5 font-medium">{monthLabel(m.month)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{usd(m.takenCents)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{usd(m.shouldCents)}</td>
                <td className="px-4 py-2.5 text-right"><Diff cents={m.takenCents - m.shouldCents} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{pct(m.takenCents, m.shouldCents)}</td>
                <td className="px-4 py-2.5"><Bars taken={m.takenCents} should={m.shouldCents} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[{ title: "Taken the least compared with the hours", rows: under }, { title: "Taken the most compared with the hours", rows: over }].map((b) => (
          <div key={b.title} className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
            <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">{b.title}</div>
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className={th}>Client</th><th className={`${th} text-right`}>Taken</th><th className={`${th} text-right`}>Should</th><th className={`${th} text-right`}>Difference</th><th className={`${th} text-right`}>%</th></tr>
              </thead>
              <tbody className="divide-y divide-border-subtle"><ClientRows rows={b.rows} /></tbody>
            </table>
          </div>
        ))}
      </div>

      <details className="rounded-lg border border-border-subtle bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">All {out.clients.length} clients</summary>
        <div className="overflow-x-auto border-t border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className={th}>Client</th><th className={`${th} text-right`}>Taken</th><th className={`${th} text-right`}>Should</th><th className={`${th} text-right`}>Difference</th><th className={`${th} text-right`}>%</th></tr>
            </thead>
            <tbody className="divide-y divide-border-subtle"><ClientRows rows={out.clients} /></tbody>
          </table>
        </div>
      </details>

      <details className="rounded-lg border border-border-subtle bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{out.sheetOnly.length} sheet clients not in the app · {out.fuzzy.length} approximate name matches</summary>
        <div className="grid gap-5 border-t border-border-subtle p-4 text-sm lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">In the sheet, no project here</div>
            <ul className="space-y-1">{out.sheetOnly.map((s) => <li key={s.name} className="flex justify-between gap-3"><span>{s.name}</span><span className="tabular-nums text-zinc-500">{usd(s.cents)}</span></li>)}</ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Matched by name (check these)</div>
            <ul className="space-y-1">{out.fuzzy.map((f) => <li key={f.sheet}><span>{f.sheet}</span> <span className="text-zinc-500">→ {f.client}</span></li>)}</ul>
          </div>
        </div>
      </details>

      <p className="text-xs text-zinc-500">
        The app only holds the Digital Marketing team&apos;s projects. Every month uses the project&apos;s current hourly rate (no rate history is kept).
        {unpriced > 0 && <> * {unpriced.toFixed(0)} hours belong to projects with no rate and are not priced.</>} A fixed project with no rate is priced at $15/h.
      </p>
    </div>
  );
}
