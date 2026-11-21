import Link from "next/link";
import { connectToDatabase } from "@/lib/db/connect";
import { loadPerformance } from "@/lib/service/performance/load";
import { fmtMinutes, shiftWeek, weekLabel } from "@/lib/service/ui/format";
import { Meter, Stat, occupancyState } from "./_components/PerfBits";

export const dynamic = "force-dynamic";

// Team performance > Overview (owner, 2026-11-20): for the chosen week, how much of each member's weekly availability is taken by their
// allocation (their usual week on the running projects they work on: what they reported in the last 4 weeks / 4), and how much of that they
// have completed so far. Only members who reported in the last 2 months and have not left.
export default async function PerformanceOverview({ searchParams }: { searchParams: Promise<{ on?: string }> }) {
  const { on } = await searchParams;
  await connectToDatabase();
  const data = await loadPerformance(on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : null);
  const { week, today, capacityMinutes } = data;
  const isCurrent = today >= week.start && today <= week.end;
  const people = data.members.filter((m) => m.active).sort((a, b) => b.occupancy - a.occupancy || a.name.localeCompare(b.name));
  const team = { capacity: people.reduce((n, m) => n + m.capacityMinutes, 0), allocated: people.reduce((n, m) => n + m.allocatedMinutes, 0), done: people.reduce((n, m) => n + m.weekMinutes, 0) };
  const q = (d?: string) => (d ? `?on=${d}` : "");
  const btn = "rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/service/performance${q(shiftWeek(week.start, -1))}`} aria-label="Previous week" className={btn}>←</Link>
          <span className="min-w-40 text-center text-sm font-medium">{weekLabel(week)}{isCurrent && <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-xs text-primary-tint-text">now</span>}</span>
          <Link href={`/service/performance${q(shiftWeek(week.start, 1))}`} aria-label="Next week" className={btn}>→</Link>
          {!isCurrent && <Link href="/service/performance" className="text-sm text-primary hover:underline">Back to this week</Link>}
        </div>
        <form action="/service/performance" method="get" className="flex items-center gap-2 text-sm">
          <label className="text-zinc-500" htmlFor="perf-date">Jump to a date</label>
          <input id="perf-date" type="date" name="on" defaultValue={week.start} max={today} className="rounded-md border border-border-subtle bg-surface px-2 py-1.5" />
          <button className={btn}>Go</button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Team availability" value={fmtMinutes(team.capacity)} note={`${people.length} members, ${fmtMinutes(capacityMinutes)} a week each (part-timers less)`} />
        <Stat label="Allocated" value={fmtMinutes(team.allocated)} note={team.capacity ? `${Math.round((team.allocated / team.capacity) * 100)}% of availability` : undefined} />
        <Stat label="Completed this week" value={fmtMinutes(team.done)} note={team.allocated ? `${Math.round((team.done / team.allocated) * 100)}% of the allocation` : undefined} />
        <Stat label="Free capacity" value={fmtMinutes(Math.max(0, team.capacity - team.allocated))} note={team.allocated > team.capacity ? `Over-allocated by ${fmtMinutes(team.allocated - team.capacity)}` : "not yet allocated"} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Occupied (allocation of the weekly availability)</th>
              <th className="px-4 py-2.5 font-medium">Completed so far</th>
              <th className="px-4 py-2.5 text-right font-medium">Left of allocation</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {people.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No active members.</td></tr>}
            {people.map((m) => {
              const st = occupancyState(m.occupancy);
              const left = Math.max(0, m.allocatedMinutes - m.weekMinutes);
              return (
                <tr key={m.key} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/service/performance/${m.slug}${q(on)}`} className="font-medium text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">{m.name}</Link>
                    <div className="text-xs text-zinc-500">{m.designation ? `${m.designation} · ` : ""}{m.projectsNow} running project{m.projectsNow === 1 ? "" : "s"}</div>
                  </td>
                  <td className="w-72 px-4 py-2.5">
                    <div className="flex justify-between text-xs tabular-nums"><span className="font-medium">{fmtMinutes(m.allocatedMinutes)}</span><span className="text-zinc-500">{Math.round(m.occupancy * 100)}% of {fmtMinutes(m.capacityMinutes)}</span></div>
                    <div className="mt-1"><Meter value={m.allocatedMinutes} max={m.capacityMinutes} over={m.occupancy > 1} /></div>
                  </td>
                  <td className="w-72 px-4 py-2.5">
                    <div className="flex justify-between text-xs tabular-nums"><span className="font-medium">{fmtMinutes(m.weekMinutes)}</span><span className="text-zinc-500">{m.allocatedMinutes ? `${Math.round((m.weekMinutes / m.allocatedMinutes) * 100)}% of allocation` : "no allocation"}</span></div>
                    <div className="mt-1"><Meter value={m.weekMinutes} max={m.allocatedMinutes || capacityMinutes} tone="bg-status-pass-icon" /></div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.allocatedMinutes ? fmtMinutes(left) : "—"}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.tone}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Availability is 8h 30m a day, Monday to Friday (half of that for Bhavesh, who works half days). A member&apos;s allocation is their usual week: the hours they reported on running projects (Active or Partial hold) in the last 4 weeks,
        divided by 4. It is today&apos;s figure, even when a past week is chosen. Completed = hours reported in the chosen week. Reported hours, not Upwork-verified.
      </p>
    </div>
  );
}
