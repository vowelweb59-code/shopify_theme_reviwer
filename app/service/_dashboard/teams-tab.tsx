import Link from "next/link";
import { load } from "@/lib/service/api/http";
import { teamsReport, type TeamPerson } from "@/lib/service/api/reports";
import { fmtMinutes } from "@/lib/service/ui/format";
import { fmtDeltaPeriod, type Period } from "@/lib/service/ui/period";
import { Kpi, LINK, Overview, SECTION, TH, THEAD, WARN } from "./kpi";
import { periodHref, type TabId } from "./period-bar";

/** The Teams report. On the dashboard `tab` is "teams"; the Team page (/service/team) shows it on its own (tab null). */
export async function TeamsTab({ period, flat, base = "/service", tab = "teams" }: { period: Period; flat: boolean; base?: string; tab?: TabId | null }) {
  const r = await load(() => teamsReport({ from: period.from, to: period.to }));
  const o = r.overview;
  const split = r.groups.length > 0 && !flat;
  const toggle = (on: boolean) => `rounded-md border border-border-subtle px-2.5 py-1 ${on ? "bg-surface-muted font-medium" : "hover:bg-surface-muted"}`;

  return (
    <div className="space-y-6">
      <Overview title="Teams overview">
        <Kpi label="Team hours" value={fmtMinutes(o.minutes)} note={fmtDeltaPeriod(o.minutes, o.previousMinutes, fmtMinutes)} />
        <Kpi label="People who logged time" value={String(o.people)} note={o.topPerson ? `Most hours: ${o.topPerson.name}, ${fmtMinutes(o.topPerson.minutes)}` : undefined} />
        <Kpi label="Average per person" value={o.people ? fmtMinutes(o.avgPerPerson) : "—"} />
        <Kpi label="On timer" value={fmtMinutes(o.timerMinutes)} note={o.minutes ? `${Math.round((o.timerMinutes / o.minutes) * 100)}% of hours` : undefined} />
        <Kpi label="Manual reports" value={fmtMinutes(o.manualMinutes)} note={o.minutes ? `${Math.round((o.manualMinutes / o.minutes) * 100)}% of hours` : undefined} />
        <Kpi label="Entries to check" value={String(o.flagged)} tone={o.flagged ? WARN : undefined} note="on the Review page" />
      </Overview>

      {r.groups.length > 0 && (
        <nav aria-label="Team view" className="flex gap-2 text-sm">
          <Link href={periodHref(base, tab, period)} aria-current={split ? "true" : undefined} className={toggle(split)}>By department</Link>
          <Link href={periodHref(base, tab, period, "&view=all")} aria-current={split ? undefined : "true"} className={toggle(!split)}>Everyone together</Link>
        </nav>
      )}

      {split ? (
        r.groups.map((g) => (
          <section key={g.id ?? "none"} aria-label={g.name} className={SECTION}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">
                {g.name} <span className="font-normal text-zinc-500">· {fmtMinutes(g.minutes)} · {g.people.length} {g.people.length === 1 ? "person" : "people"}</span>
              </h2>
              <span className="text-xs text-zinc-500">{g.isDefault ? "Default: every other project" : g.manager ? `Manager: ${g.manager}` : g.id ? "No manager set" : "Unknown client or in-house"}</span>
            </div>
            <PeopleTable people={g.people} period={period} workingDays={r.workingDays} showDelta={false} />
          </section>
        ))
      ) : (
        <section aria-labelledby="people" className={SECTION}>
          <h2 id="people" className="font-medium">People</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Reported and tracked hours, not Upwork-verified. {r.workingDays} working day{r.workingDays === 1 ? "" : "s"} (Monday to Saturday) in this period.
          </p>
          <PeopleTable people={r.people} period={period} workingDays={r.workingDays} showDelta />
        </section>
      )}
    </div>
  );
}

function PeopleTable({ people, period, workingDays, showDelta }: { people: TeamPerson[]; period: Period; workingDays: number; showDelta: boolean }) {
  if (people.length === 0) return <p className="mt-3 text-sm text-zinc-500">No hours in this period.</p>;
  const dash = <span className="text-zinc-400">—</span>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className={THEAD}>
          <tr className="border-b border-border-subtle text-left">
            <th className={TH}>Person</th>
            <th className={`${TH} text-right`}>Hours</th>
            <th className={`${TH} text-right`}>Days worked</th>
            <th className={`${TH} text-right`}>Per day</th>
            <th className={`${TH} text-right`}>Timer</th>
            <th className={`${TH} text-right`}>Manual</th>
            <th className={TH}>Main projects</th>
            <th className="py-2 text-right font-medium">To check</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {people.map((p) => (
            <tr key={p.id} className="hover:bg-surface-muted/60">
              <td className="whitespace-nowrap py-2 pr-3">
                <Link href={`/service/team/${p.id}?week=${period.from}`} className={LINK}>{p.name}</Link>
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">
                <div className="font-medium">{fmtMinutes(p.minutes)}</div>
                {showDelta && <div className="text-xs text-zinc-500">{fmtDeltaPeriod(p.minutes, p.previousMinutes, fmtMinutes)}</div>}
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{p.activeDays} <span className="text-zinc-500">of {workingDays}</span></td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{p.activeDays ? fmtMinutes(p.avgPerActiveDay) : "—"}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{p.timerMinutes ? fmtMinutes(p.timerMinutes) : dash}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{p.manualMinutes ? fmtMinutes(p.manualMinutes) : dash}</td>
              <td className="py-2 pr-3 text-xs">
                {p.projects.slice(0, 3).map((x) => `${x.name} ${fmtMinutes(x.minutes)}`).join(" · ")}
                {p.projects.length > 3 && <span className="text-zinc-500"> · +{p.projects.length - 3} more</span>}
              </td>
              <td className="py-2 text-right tabular-nums">{p.flagged > 0 ? <span className={WARN}>{p.flagged}</span> : dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
