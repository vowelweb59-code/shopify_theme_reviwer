import Link from "next/link";
import type { ReactNode } from "react";
import { compare, type AppClient, type ClientLine, type ClientStatus, type HoursRow, type TakenRow } from "@/lib/service/revenue/compare";
import { fmtUsd } from "@/lib/service/ui/format";

// Revenue tab (owner, 2026-11-17): money actually taken from clients (the sales sheet) against what the reported hours were worth.
// Laid out as one question at a time: pick the period, pick Active / On hold / Closed (the client's project status), read the totals,
// then the clients. Hours were worth = reported hours x the project's hourly rate (a fixed project with no rate: $15/h).

const RANGES = [
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "This year" },
  { id: "all", label: "All time" },
] as const;

const GROUPS = [
  { id: "active", label: "Active", dot: "bg-status-pass-icon", hint: "clients with a running project" },
  { id: "on_hold", label: "On hold", dot: "bg-status-warning-icon", hint: "clients whose projects are on hold" },
  { id: "closed", label: "Closed", dot: "bg-status-info-icon", hint: "clients whose projects are finished" },
  { id: "not_in_app", label: "Not in the app", dot: "bg-status-not-tested-icon", hint: "paid in the sales sheet, no project here" },
  { id: "all", label: "All", dot: "bg-primary", hint: "every client in the sales sheet" },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

const usd = (cents: number) => fmtUsd(Math.round(cents)).replace(/\.00$/, "");
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const shift = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7); };
const link = (range: string, group: string) => {
  const q = new URLSearchParams();
  if (range !== "12m") q.set("range", range);
  if (group !== "active") q.set("status", group);
  return q.size ? `/service/revenue?${q}` : "/service/revenue";
};

function Kpi({ label, value, note, accent }: { label: string; value: ReactNode; note?: ReactNode; accent: string }) {
  return (
    <div className={`rounded-lg border border-l-4 border-border-subtle ${accent} bg-surface p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

/** Plain-words result for one client: took less / took more / about right / not priced. */
function Result({ taken, should, unpriced }: { taken: number; should: number; unpriced: boolean }) {
  if (should <= 0) return <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-text">{unpriced ? "No rate set" : "No hours"}</span>;
  const ratio = taken / should;
  if (ratio < 0.95) return <span className="rounded-full bg-status-fail-bg px-2 py-0.5 text-xs font-medium text-status-fail-text">Took less</span>;
  if (ratio > 1.05) return <span className="rounded-full bg-status-pass-bg px-2 py-0.5 text-xs font-medium text-status-pass-text">Took more</span>;
  return <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-xs font-medium text-status-info-text">About right</span>;
}

const Diff = ({ cents }: { cents: number }) => (
  <span className={`tabular-nums ${cents < 0 ? "text-status-fail-text" : cents > 0 ? "text-status-pass-text" : "text-zinc-500"}`}>{cents > 0 ? "+" : cents < 0 ? "−" : ""}{usd(Math.abs(cents))}</span>
);

function ClientTable({ rows }: { rows: ClientLine[] }) {
  const th = "px-4 py-2.5 font-medium";
  return (
    <table className="w-full text-sm">
      <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr>
          <th className={th}>Client</th>
          <th className={`${th} text-right`}>We took</th>
          <th className={`${th} text-right`}>Hours were worth</th>
          <th className={`${th} text-right`}>Difference</th>
          <th className={th}>Result</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.map((c) => (
          <tr key={c.clientId} className="hover:bg-surface-muted/50">
            <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
              {c.name}
              <div className="text-xs font-normal text-zinc-500">{c.hours.toLocaleString("en-IN", { maximumFractionDigits: 0 })} h reported</div>
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{usd(c.takenCents)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{usd(c.shouldCents)}</td>
            <td className="px-4 py-2.5 text-right"><Diff cents={c.takenCents - c.shouldCents} /></td>
            <td className="px-4 py-2.5"><Result taken={c.takenCents} should={c.shouldCents} unpriced={c.unpricedHours > 0} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevenueView({ input, rangeId, statusId }: { input: { taken: TakenRow[]; clients: AppClient[]; hours: HoursRow[] }; rangeId?: string; statusId?: string }) {
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[0];
  const group = GROUPS.find((g) => g.id === statusId) ?? GROUPS[0];
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
  const everything = compare(input.taken, input.clients, input.hours, from, last);

  // The tabs: how many clients (and how much money) sit in each group.
  const inGroup = (c: ClientLine, id: GroupId) => id === "all" || (id !== "not_in_app" && c.status === id);
  const tabInfo = GROUPS.map((g) => {
    const clients = everything.clients.filter((c) => inGroup(c, g.id));
    const sheetOnly = g.id === "not_in_app" || g.id === "all" ? everything.sheetOnly : [];
    return { ...g, count: clients.length + sheetOnly.length };
  });

  // The selected group: its clients and its month-by-month totals.
  const ids = new Set(everything.clients.filter((c) => inGroup(c, group.id)).map((c) => c.clientId));
  const scoped = group.id === "all" || group.id === "not_in_app" ? everything : compare(input.taken, input.clients, input.hours, from, last, ids);
  const clients = (group.id === "not_in_app" ? [] : everything.clients.filter((c) => inGroup(c, group.id))).sort((a, b) => b.takenCents - a.takenCents || a.name.localeCompare(b.name)); // highest money taken first (owner, 2026-11-20)
  const sheetOnly = group.id === "not_in_app" || group.id === "all" ? everything.sheetOnly : [];
  const months = group.id === "not_in_app" ? [] : scoped.months;

  const taken = clients.reduce((n, c) => n + c.takenCents, 0) + sheetOnly.reduce((n, s) => n + s.cents, 0);
  const should = clients.reduce((n, c) => n + c.shouldCents, 0);
  const gap = taken - should;
  const unpricedHours = clients.reduce((n, c) => n + c.unpricedHours, 0);
  const shown = clients.slice(0, 25);
  const rest = clients.slice(25);
  const kind = (id: ClientStatus | null) => id;
  void kind;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Revenue: what we took vs what the hours were worth</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">We took</strong> = money in your sales sheet.{" "}
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">Hours were worth</strong> = hours reported by your Digital Marketing team × the hourly rate (other teams&apos; hours on the same projects are left out, as the sheet is your team&apos;s revenue only).{" "}
            {monthLabel(from)} to {monthLabel(last)}.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-border-subtle">
          {RANGES.map((r) => (
            <Link key={r.id} href={link(r.id, group.id)} aria-current={r.id === range.id ? "page" : undefined}
              className={`border-r border-border-subtle px-3 py-1.5 text-sm last:border-r-0 ${r.id === range.id ? "bg-primary-tint font-medium text-primary-tint-text" : "bg-surface text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <nav aria-label="Client status" className="flex flex-wrap gap-5 border-b border-border-subtle">
        {tabInfo.map((g) => (
          <Link key={g.id} href={link(range.id, g.id)} aria-current={g.id === group.id ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2 text-sm ${g.id === group.id ? "border-primary font-medium text-primary-tint-text" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
            <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden="true" />
            {g.label}
            <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${g.id === group.id ? "bg-primary-tint text-primary-tint-text" : "bg-surface-muted text-zinc-500"}`}>{g.count}</span>
          </Link>
        ))}
      </nav>
      <p className="-mt-2 text-sm text-zinc-500">{group.label}: {group.hint}.</p>

      {group.id === "not_in_app" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi accent="border-l-status-pass-icon" label="We took" value={usd(taken)} note={`from ${sheetOnly.length} clients`} />
            <Kpi accent="border-l-status-not-tested-icon" label="Hours were worth" value="Not known" note="these clients have no project in the app, so no hours are reported here" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="px-4 py-2.5 font-medium">Client (as written in the sheet)</th><th className="px-4 py-2.5 text-right font-medium">We took</th></tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sheetOnly.map((s) => <tr key={s.name}><td className="px-4 py-2.5">{s.name}</td><td className="px-4 py-2.5 text-right tabular-nums">{usd(s.cents)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi accent="border-l-status-pass-icon" label="We took" value={usd(taken)} note="money in the sales sheet" />
            <Kpi accent="border-l-primary" label="Hours were worth" value={usd(should)} note="your team's hours × hourly rate" />
            <Kpi accent={gap < 0 ? "border-l-status-fail-icon" : "border-l-status-info-icon"} label={gap < 0 ? "We took less by" : "We took more by"} value={usd(Math.abs(gap))} note={should > 0 ? `we took ${Math.round((taken / should) * 100)}% of what the hours were worth` : undefined} />
            <Kpi accent="border-l-status-warning-icon" label="Clients" value={clients.length.toLocaleString("en-IN")} note={`${clients.filter((c) => c.takenCents < c.shouldCents * 0.95).length} took less · ${clients.filter((c) => c.takenCents > c.shouldCents * 1.05).length} took more`} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
            <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">{group.label} clients <span className="font-normal text-zinc-500">· the ones where we took the least compared with the hours come first</span></div>
            {clients.length === 0 ? <p className="px-4 py-8 text-center text-sm text-zinc-500">No clients in this group for this period.</p> : <ClientTable rows={shown} />}
          </div>
          {rest.length > 0 && (
            <details className="rounded-lg border border-border-subtle bg-surface">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Show the other {rest.length} clients</summary>
              <div className="overflow-x-auto border-t border-border-subtle"><ClientTable rows={rest} /></div>
            </details>
          )}

          <details className="rounded-lg border border-border-subtle bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Month by month ({group.label.toLowerCase()} clients)</summary>
            <div className="overflow-x-auto border-t border-border-subtle">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr><th className="px-4 py-2.5 font-medium">Month</th><th className="px-4 py-2.5 text-right font-medium">We took</th><th className="px-4 py-2.5 text-right font-medium">Hours were worth</th><th className="px-4 py-2.5 text-right font-medium">Difference</th></tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {[...months].reverse().map((m) => (
                    <tr key={m.month}>
                      <td className="px-4 py-2.5 font-medium">{monthLabel(m.month)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{usd(m.takenCents)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{usd(m.shouldCents)}</td>
                      <td className="px-4 py-2.5 text-right"><Diff cents={m.takenCents - m.shouldCents} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <details className="rounded-lg border border-border-subtle bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{everything.fuzzy.length} client names matched approximately (check these)</summary>
        <ul className="grid gap-1 border-t border-border-subtle p-4 text-sm sm:grid-cols-2">
          {everything.fuzzy.map((f) => <li key={f.sheet}><span>{f.sheet}</span> <span className="text-zinc-500">→ {f.client}</span></li>)}
        </ul>
      </details>

      <p className="text-xs text-zinc-500">
        Every month uses the project&apos;s current hourly rate (no rate history is kept). A fixed project with no rate is priced at $15/h.
        {unpricedHours > 0 && <> {unpricedHours.toFixed(0)} hours in this group belong to projects with no rate and are not priced.</>}
      </p>
    </div>
  );
}
