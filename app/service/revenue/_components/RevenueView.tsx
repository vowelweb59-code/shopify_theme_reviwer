import Link from "next/link";
import type { ReactNode } from "react";
import type { AppClient } from "@/lib/service/revenue/compare";
import { revenueByProject, type ProjectHours, type ProjectLine, type RevProject, type SheetRow } from "@/lib/service/revenue/by-project";
import { fmtMinutes, fmtUsd, ServiceStatusBadge } from "@/lib/service/ui/format";
import type { ServiceProjectStatus } from "@/models/service-shared";

// Revenue tab (owner, 2026-11-17; by project since 2026-11-21): money actually taken (the sales sheet) against what the reported hours were
// worth, for EVERY project of the app, so the total matches the Projects tab. For the chosen period a project is Active when the team
// reported hours on it or money was taken for it, otherwise Inactive. The sheet has money per client and profile, so it is given to the
// client's project whose profile matches, else shared by that month's hours (see lib/service/revenue/by-project.ts). A project the sheet
// has no money for stays in the list with an empty "We took".

const RANGES = [
  { id: "1m", label: "Last month" },
  { id: "12m", label: "Last 12 months" },
  { id: "ytd", label: "This year" },
  { id: "all", label: "All time" },
] as const;

const GROUPS = [
  { id: "active", label: "Active", dot: "bg-status-pass-icon", hint: "projects the team worked on, or that we took money for, in this period" },
  { id: "inactive", label: "Inactive", dot: "bg-status-not-tested-icon", hint: "every other project: no hours and no money in this period" },
  { id: "all", label: "All", dot: "bg-primary", hint: "every project, the same count as the Projects tab" },
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
const SHOWN = 50;

function Kpi({ label, value, note, accent }: { label: string; value: ReactNode; note?: ReactNode; accent: string }) {
  return (
    <div className={`rounded-lg border border-l-4 border-border-subtle ${accent} bg-surface p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

/** Plain-words result for a project the sheet has money for: took less / took more / about right / not priced. */
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

function ProjectTable({ rows }: { rows: ProjectLine[] }) {
  const th = "px-4 py-2.5 font-medium";
  return (
    <table className="w-full min-w-[820px] text-sm">
      <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr>
          <th className={th}>Project</th>
          <th className={th}>Status</th>
          <th className={`${th} text-right`}>Hours</th>
          <th className={`${th} text-right`}>We took</th>
          <th className={`${th} text-right`}>Hours were worth</th>
          <th className={`${th} text-right`}>Difference</th>
          <th className={th}>Result</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-surface-muted/50">
            <td className="px-4 py-2.5">
              <Link href={`/service/projects/${p.id}`} className="font-medium text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">{p.name}</Link>
            </td>
            <td className="px-4 py-2.5"><ServiceStatusBadge status={p.status as ServiceProjectStatus} /></td>
            <td className="px-4 py-2.5 text-right tabular-nums">{p.minutes ? fmtMinutes(p.minutes) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{p.hasSheetMoney ? usd(p.takenCents) : ""}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{p.minutes ? (p.shouldCents > 0 ? usd(p.shouldCents) : <span className="text-zinc-400" title="No rate on this project">no rate</span>) : ""}</td>
            <td className="px-4 py-2.5 text-right">{p.hasSheetMoney ? <Diff cents={p.takenCents - p.shouldCents} /> : ""}</td>
            <td className="px-4 py-2.5">{p.hasSheetMoney ? <Result taken={p.takenCents} should={p.shouldCents} unpriced={p.unpricedMinutes > 0} /> : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevenueView({ input, rangeId, statusId }: { input: { taken: SheetRow[]; clients: AppClient[]; projects: RevProject[]; hours: ProjectHours[] }; rangeId?: string; statusId?: string }) {
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES.find((r) => r.id === "12m")!;
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
  // "Last month" = the newest month the sales sheet has (owner, 2026-11-21): money taken is only known up to that month.
  const from = range.id === "1m" ? last : range.id === "12m" ? shift(last, -11) : range.id === "ytd" ? `${last.slice(0, 4)}-01` : first;
  const rev = revenueByProject(input, from, last);

  const inGroup = (p: ProjectLine, id: GroupId) => id === "all" || (id === "active" ? p.active : !p.active);
  const counts = Object.fromEntries(GROUPS.map((g) => [g.id, rev.projects.filter((p) => inGroup(p, g.id)).length])) as Record<GroupId, number>;
  // Highest money first (owner, 2026-11-20); projects with no sales data follow, by what their hours were worth.
  const rows = rev.projects.filter((p) => inGroup(p, group.id)).sort((a, b) => (b.hasSheetMoney ? b.takenCents : -1) - (a.hasSheetMoney ? a.takenCents : -1) || b.shouldCents - a.shouldCents || a.name.localeCompare(b.name));
  const withMoney = rows.filter((p) => p.hasSheetMoney);
  const noMoney = rows.filter((p) => !p.hasSheetMoney);
  const taken = withMoney.reduce((n, p) => n + p.takenCents, 0);
  // Compared like with like: the hours of the projects the sheet has money for.
  const should = withMoney.reduce((n, p) => n + p.shouldCents, 0);
  const gap = taken - should;
  const unpriced = rows.reduce((n, p) => n + p.unpricedMinutes, 0);
  const noMoneyWorth = noMoney.reduce((n, p) => n + p.shouldCents, 0);
  const noMoneyMinutes = noMoney.reduce((n, p) => n + p.minutes, 0);
  const months = new Map<string, { taken: number; should: number }>();
  for (const p of rows) for (const [m, v] of Object.entries(p.months)) { const c = months.get(m) ?? { taken: 0, should: 0 }; c.taken += v.takenCents; c.should += v.shouldCents; months.set(m, c); }
  const sheetOnlyTotal = rev.sheetOnly.reduce((n, s) => n + s.cents, 0);
  const shown = rows.slice(0, SHOWN);
  const rest = rows.slice(SHOWN);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Revenue: what we took vs what the hours were worth</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">We took</strong> = money in your sales sheet.{" "}
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">Hours were worth</strong> = hours reported by your Digital Marketing team × the hourly rate (other teams&apos; hours on the same projects are left out, as the sheet is your team&apos;s revenue only).{" "}
            {from === last ? `${monthLabel(last)} (the newest month in the sales sheet).` : `${monthLabel(from)} to ${monthLabel(last)}.`}
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

      <nav aria-label="Project activity" className="flex flex-wrap gap-5 border-b border-border-subtle">
        {GROUPS.map((g) => (
          <Link key={g.id} href={link(range.id, g.id)} aria-current={g.id === group.id ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2 text-sm ${g.id === group.id ? "border-primary font-medium text-primary-tint-text" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
            <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden="true" />
            {g.label}
            <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${g.id === group.id ? "bg-primary-tint text-primary-tint-text" : "bg-surface-muted text-zinc-500"}`}>{counts[g.id]}</span>
          </Link>
        ))}
      </nav>
      <p className="-mt-2 text-sm text-zinc-500">{group.label}: {group.hint}. {counts.active} active + {counts.inactive} inactive = {counts.all} projects.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi accent="border-l-status-pass-icon" label="We took" value={usd(taken)} note={`from ${withMoney.length} projects with sales data`} />
        <Kpi accent="border-l-primary" label="Hours were worth" value={usd(should)} note="the same projects: your team's hours × hourly rate" />
        <Kpi accent={gap < 0 ? "border-l-status-fail-icon" : "border-l-status-info-icon"} label={gap < 0 ? "We took less by" : "We took more by"} value={usd(Math.abs(gap))} note={should > 0 ? `we took ${Math.round((taken / should) * 100)}% of what the hours were worth` : undefined} />
        <Kpi accent="border-l-status-warning-icon" label="Projects" value={rows.length.toLocaleString("en-IN")} note={`${withMoney.length} with sales data · ${noMoney.length} without (empty)`} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">{group.label} projects <span className="font-normal text-zinc-500">· highest money taken first; projects with no sales data come last and keep an empty &quot;We took&quot;</span></div>
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-zinc-500">No projects in this group for this period.</p> : <ProjectTable rows={shown} />}
      </div>
      {rest.length > 0 && (
        <details className="rounded-lg border border-border-subtle bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Show the other {rest.length} projects</summary>
          <div className="overflow-x-auto border-t border-border-subtle"><ProjectTable rows={rest} /></div>
        </details>
      )}
      {noMoney.length > 0 && noMoneyMinutes > 0 && (
        <p className="text-xs text-zinc-500">{noMoney.filter((p) => p.minutes > 0).length} projects here have hours but no sales data: {fmtMinutes(noMoneyMinutes)}, worth {usd(noMoneyWorth)}, not part of the comparison above.</p>
      )}

      <details className="rounded-lg border border-border-subtle bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Month by month ({group.label.toLowerCase()} projects)</summary>
        <div className="overflow-x-auto border-t border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="px-4 py-2.5 font-medium">Month</th><th className="px-4 py-2.5 text-right font-medium">We took</th><th className="px-4 py-2.5 text-right font-medium">Hours were worth</th><th className="px-4 py-2.5 text-right font-medium">Difference</th></tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {[...months].sort((a, b) => b[0].localeCompare(a[0])).map(([m, v]) => (
                <tr key={m}>
                  <td className="px-4 py-2.5 font-medium">{monthLabel(m)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{usd(v.taken)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{usd(v.should)}</td>
                  <td className="px-4 py-2.5 text-right"><Diff cents={v.taken - v.should} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {rev.sheetOnly.length > 0 && (
        <details className="rounded-lg border border-border-subtle bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{rev.sheetOnly.length} clients in the sales sheet have no project in the app ({usd(sheetOnlyTotal)}, not in the totals above)</summary>
          <div className="overflow-x-auto border-t border-border-subtle">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border-subtle">
                {rev.sheetOnly.map((s) => <tr key={s.name}><td className="px-4 py-2.5">{s.name}</td><td className="px-4 py-2.5 text-right tabular-nums">{usd(s.cents)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <details className="rounded-lg border border-border-subtle bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{rev.fuzzy.length} client names matched approximately (check these)</summary>
        <ul className="grid gap-1 border-t border-border-subtle p-4 text-sm sm:grid-cols-2">
          {rev.fuzzy.map((f) => <li key={f.sheet}><span>{f.sheet}</span> <span className="text-zinc-500">→ {f.client}</span></li>)}
        </ul>
      </details>

      <p className="text-xs text-zinc-500">
        The sheet records money per client and profile, not per project: a row goes to the client&apos;s project with the same Upwork profile, otherwise it is shared between the client&apos;s projects by that month&apos;s hours.
        Every month uses the project&apos;s current hourly rate (no rate history is kept); a fixed project with no rate is priced at $15/h.
        {unpriced > 0 && <> {fmtMinutes(unpriced)} here belong to projects with no rate and are not priced.</>}
      </p>
    </div>
  );
}
