import Link from "next/link";
import { connectToDatabase } from "@/lib/db/connect";
import { RANGES, loadAnalytics } from "@/lib/service/analytics/load";
import { fmtDay, fmtLongDay, fmtMinutes, fmtUsd } from "@/lib/service/ui/format";
import { BarChart, HBars, Kpi, Panel, RankTable } from "./_components/Charts";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const monthShort = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const weekEnd = (start: string) => new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
const weekText = (start: string) => `${fmtDay(start)} – ${fmtDay(weekEnd(start))}`;
const stars = (r: number | null) => (r === null ? "—" : `★ ${r.toFixed(1)}`);
const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  ACTIVE: "Active",
  BLOCKED: "Blocked",
  WAITING_FOR_CLIENT: "Waiting for client",
  ON_HOLD: "On hold",
  PARTIAL_HOLD: "Partial hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
};

// Service > Analytics (owner, 2026-11-21: "top clients, best weeks, highest weekly work done (hours and capacity), top performing teammate ... much more
// detail"): the dashboard of the team's record over a chosen range. Digital Marketing hours only; value = hours x the project's rate.
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeRaw } = await searchParams;
  await connectToDatabase();
  const { range, today, fromDate, data: d, memberName, memberSlug, left } = await loadAnalytics(rangeRaw);
  const k = d.kpis;
  const active = d.teammates; // everyone, including people who left or went quiet (owner, 2026-11-25)
  const topPerformer = active[0];
  const chartWeeks = d.weekly.slice(-52);
  const name = (key: string) => (
    <Link href={`/service/performance/${memberSlug(key)}`} className="font-medium hover:text-primary hover:underline">
      {memberName(key)}
      {left(key) ? " (left)" : ""}
    </Link>
  );
  const pill = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${on ? "bg-primary-tint font-medium text-primary-tint-text" : "text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`;
  const totalProjects = d.statusMix.reduce((n, s) => n + s.count, 0);
  const ratedTotal = d.ratingHistogram.reduce((n, x) => n + x, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Range" className="inline-flex gap-1 rounded-xl border border-border-subtle bg-surface-muted p-1">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={r.id === "12w" ? "/service/analytics" : `/service/analytics?range=${r.id}`}
              aria-current={r.id === range.id ? "page" : undefined}
              className={pill(r.id === range.id)}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-zinc-500">
          {fromDate ? `${fmtLongDay(fromDate)} – ${fmtLongDay(today)}` : `Everything up to ${fmtLongDay(today)}`} · your Digital Marketing team&apos;s hours ·
          reported, not Upwork-verified
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Value earned" value={fmtUsd(k.valueCents)} note="hours × each project's rate" />
        <Kpi label="Hours worked" value={fmtMinutes(k.minutes)} note={`${k.projects} projects · ${k.clients} clients`} />
        <Kpi label="Average week" value={fmtMinutes(k.avgWeekMinutes)} note={`over ${k.weeks} finished weeks`} />
        <Kpi label="Capacity used" value={k.utilization === null ? "—" : pct(k.utilization)} note="hours ÷ the team's availability" />
        <Kpi label="Average review" value={stars(k.rating)} note={`${k.ratedProjects} reviewed projects, weighted by hours`} />
        <Kpi label="Top 5 clients" value={pct(d.concentration.top5)} note={`of the value · the biggest alone ${pct(d.concentration.top1)}`} />
      </div>

      {topPerformer && (
        <section className="rounded-lg border border-border-subtle border-l-4 border-l-primary bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Top performing teammate · most value earned in this range</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-xl font-semibold">{name(topPerformer.key)}</span>
            <span className="tabular-nums">{fmtUsd(topPerformer.valueCents)}</span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              {fmtMinutes(topPerformer.minutes)} on {topPerformer.projects} projects
            </span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              {stars(topPerformer.rating)}
              {topPerformer.ratedProjects ? ` (${topPerformer.ratedProjects} reviewed)` : ""}
            </span>
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{pct(topPerformer.utilization)} of capacity in a usual week</span>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Hours each week" note={`The last ${chartWeeks.length} weeks. The grey bar is the week still running.`}>
          <BarChart
            ariaLabel="Team hours per week"
            items={chartWeeks.map((w) => ({
              label: fmtDay(w.start),
              value: w.minutes,
              tip: `${weekText(w.start)}: ${fmtMinutes(w.minutes)}${w.current ? " (week still running)" : ""}`,
              muted: w.current,
            }))}
          />
        </Panel>
        <Panel title="Capacity used each week" note="Hours as a share of the availability of the members active that week. The dashed line is 100%.">
          <BarChart
            ariaLabel="Team utilisation per week"
            refLine={1}
            refLabel="100%"
            items={chartWeeks.map((w) => ({
              label: fmtDay(w.start),
              value: w.utilization,
              tip: `${weekText(w.start)}: ${pct(w.utilization)} of ${fmtMinutes(w.capacityMinutes)} (${w.members} members)${w.current ? " (week still running)" : ""}`,
              muted: w.current,
            }))}
          />
        </Panel>
        <Panel title="Value earned each month" note="Hours × each project's rate.">
          <BarChart
            ariaLabel="Value earned per month"
            items={d.monthly.map((m) => ({
              label: monthShort(m.month),
              value: m.valueCents,
              tip: `${monthShort(m.month)}: ${fmtUsd(m.valueCents)} from ${fmtMinutes(m.minutes)}`,
            }))}
            every={d.monthly.length > 14 ? 3 : 1}
          />
        </Panel>
        <Panel title="New work each month" note="Projects and clients whose very first report fell in that month.">
          <RankTable
            head={["Month", "New projects", "New clients"]}
            rows={[...d.monthly]
              .reverse()
              .slice(0, 8)
              .map((m) => [monthShort(m.month), m.newProjects, m.newClients])}
          />
        </Panel>
      </div>

      <Panel title="Top clients" note="Ranked by value earned in this range. Share = part of all the value; reviews are weighted by hours.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-border-subtle text-left">
                <th className="w-6 py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-3 font-medium">Client</th>
                <th className="py-1.5 pr-3 text-right font-medium">Value earned</th>
                <th className="w-48 py-1.5 pr-3 font-medium">Share</th>
                <th className="py-1.5 pr-3 text-right font-medium">Hours</th>
                <th className="py-1.5 pr-3 text-right font-medium">Projects</th>
                <th className="py-1.5 pr-3 text-right font-medium">Weeks active</th>
                <th className="py-1.5 pr-3 text-right font-medium">Review</th>
                <th className="py-1.5 text-right font-medium">Last report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {d.clients.slice(0, 15).map((c, n) => (
                <tr key={c.clientId}>
                  <td className="py-1.5 pr-2 text-zinc-400 tabular-nums">{n + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{c.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtUsd(c.valueCents)}</td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, c.share * 100 * 2.5)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-zinc-500">{pct(c.share)}</span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtMinutes(c.minutes)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{c.projects}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{c.weeks}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{stars(c.rating)}</td>
                  <td className="py-1.5 text-right text-zinc-500">{fmtLongDay(c.lastReport)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          The bars show each share on a 40% scale. {d.clients.length > 15 ? `${d.clients.length - 15} more clients are not shown.` : ""}
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Best weeks · most hours" note="Finished weeks only.">
          <RankTable head={["Week", "Hours", "Members"]} rows={d.bestWeeks.byHours.map((w) => [weekText(w.start), fmtMinutes(w.minutes), w.members])} />
        </Panel>
        <Panel title="Best weeks · most value" note="Finished weeks only.">
          <RankTable head={["Week", "Value", "Clients"]} rows={d.bestWeeks.byValue.map((w) => [weekText(w.start), fmtUsd(w.valueCents), w.clients])} />
        </Panel>
        <Panel title="Best weeks · capacity used" note="Hours ÷ the availability of the members active that week.">
          <RankTable
            head={["Week", "Capacity", "Hours"]}
            rows={d.bestWeeks.byUtilization.map((w) => [weekText(w.start), pct(w.utilization), fmtMinutes(w.minutes)])}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Highest weekly work done · hours" note="The heaviest single weeks of one person.">
          <RankTable
            head={["Teammate", "Week", "Hours", "Projects"]}
            rows={d.personWeeks.byHours.map((x) => [name(x.member), weekText(x.start), fmtMinutes(x.minutes), x.projects])}
          />
        </Panel>
        <Panel title="Highest weekly work done · capacity" note="Hours ÷ that person's own weekly availability (half-day members against half a week).">
          <RankTable
            head={["Teammate", "Week", "Capacity", "Hours"]}
            rows={d.personWeeks.byCapacity.map((x) => [name(x.member), weekText(x.start), pct(x.pct), fmtMinutes(x.minutes)])}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Teammates · most value" note="Members still with the company who reported in the last 2 months.">
          <HBars
            rows={top(active, 8, (t) => t.valueCents).map((t) => ({
              label: memberName(t.key),
              href: `/service/performance/${memberSlug(t.key)}`,
              value: t.valueCents,
              display: fmtUsd(t.valueCents),
            }))}
          />
        </Panel>
        <Panel title="Teammates · most hours">
          <HBars
            rows={top(active, 8, (t) => t.minutes).map((t) => ({
              label: memberName(t.key),
              href: `/service/performance/${memberSlug(t.key)}`,
              value: t.minutes,
              display: fmtMinutes(t.minutes),
              sub: `${t.projects} projects`,
            }))}
          />
        </Panel>
        <Panel title="Teammates · best reviews" note="At least 3 reviewed projects; weighted by hours, no review = 3.5★, 5★ and 1–2★ weigh more.">
          <HBars
            rows={top(
              active.filter((t) => t.ratedProjects >= 3 && t.rating !== null),
              8,
              (t) => t.rating ?? 0
            ).map((t) => ({
              label: memberName(t.key),
              href: `/service/performance/${memberSlug(t.key)}`,
              value: t.rating ?? 0,
              display: stars(t.rating),
              sub: `${t.ratedProjects} reviewed`,
            }))}
            empty="No one has 3 reviewed projects in this range."
          />
        </Panel>
        <Panel title="Teammates · capacity in a usual week" note="Average finished week ÷ own availability; at least 4 active weeks.">
          <HBars
            rows={top(
              active.filter((t) => t.activeWeeks >= 4),
              8,
              (t) => t.utilization
            ).map((t) => ({
              label: memberName(t.key),
              href: `/service/performance/${memberSlug(t.key)}`,
              value: t.utilization,
              display: pct(t.utilization),
              sub: `${fmtMinutes(t.avgWeekMinutes)} a week`,
            }))}
            empty="No one has 4 finished weeks in this range."
          />
        </Panel>
        <Panel title="Teammates · biggest single week" note="Most hours one person did in a finished week.">
          <HBars
            rows={top(active, 8, (t) => t.peakWeekMinutes).map((t) => ({
              label: memberName(t.key),
              href: `/service/performance/${memberSlug(t.key)}`,
              value: t.peakWeekMinutes,
              display: fmtMinutes(t.peakWeekMinutes),
            }))}
          />
        </Panel>
        <Panel title="Teammates · most projects handled">
          <HBars
            rows={top(active, 8, (t) => t.projects).map((t) => ({
              label: memberName(t.key),
              href: `/service/performance/${memberSlug(t.key)}`,
              value: t.projects,
              display: String(t.projects),
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="Projects by status" note={`${totalProjects} projects in the app, today.`}>
          <HBars rows={d.statusMix.map((s) => ({ label: STATUS_LABEL[s.status] ?? s.status, value: s.count, display: String(s.count) }))} />
        </Panel>
        <Panel title="Closing reviews" note={`${ratedTotal} projects with a rating, all time.`}>
          <HBars
            rows={[5, 4, 3, 2, 1].map((n) => ({
              label: `${n} star${n === 1 ? "" : "s"}`,
              value: d.ratingHistogram[n - 1],
              display: String(d.ratingHistogram[n - 1]),
            }))}
          />
        </Panel>
        <Panel title="Top Upwork profiles" note="By value earned in this range.">
          <HBars
            rows={d.profiles.slice(0, 8).map((p) => ({ label: p.name, sub: `${p.projects} projects`, value: p.valueCents, display: fmtUsd(p.valueCents) }))}
          />
        </Panel>
        <Panel title="Top business developers" note="Value of the projects each is named on (a project counts for every BD on it).">
          <HBars rows={d.bds.slice(0, 8).map((p) => ({ label: p.name, sub: `${p.projects} projects`, value: p.valueCents, display: fmtUsd(p.valueCents) }))} />
        </Panel>
        <Panel title="Top business analysts" note="Same rule as the developers." className="xl:col-span-2">
          <HBars rows={d.bas.slice(0, 8).map((p) => ({ label: p.name, sub: `${p.projects} projects`, value: p.valueCents, display: fmtUsd(p.valueCents) }))} />
        </Panel>
      </div>

      <p className="text-xs text-zinc-500">
        Capacity = 8h 30m a day, Monday to Friday per member (half of that for Bhavesh and Hamza); a member counts toward a week when they reported in it or in
        the three weeks before. Availability is today&apos;s for every past week. Hours dated after today are ignored. Value = hours × the project&apos;s hourly
        rate (fixed work with no rate at $15/h; hourly work with no rate counts as nothing).
      </p>
    </div>
  );
}

function top<T>(xs: readonly T[], n: number, by: (x: T) => number): T[] {
  return [...xs].sort((a, b) => by(b) - by(a)).slice(0, n);
}
