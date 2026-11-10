import Link from "next/link";
import { load } from "@/lib/service/api/http";
import { teamDetail } from "@/lib/service/api/team";
import { fmtDelta, fmtMinutes, shiftWeek, weekLabel } from "@/lib/service/ui/format";
import { Kpi, SECTION, WARN } from "../../_dashboard/kpi";
import { ProfileCard } from "./profile-card";

export const dynamic = "force-dynamic";

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const stepLink = "rounded-md border border-border-subtle px-2 py-1 hover:bg-surface-muted";

export default async function ServicePersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string; view?: string }> }) {
  const { id } = await params;
  const { week, view } = await searchParams;
  const d = await load(() => teamDetail(id, week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : null));
  const href = (start: string) => `/service/team/${id}?week=${start}`;
  const settings = view === "settings";
  const busiestDay = Math.max(1, ...d.byDay.map((x) => x.minutes));
  const busiestWeek = Math.max(1, ...d.weeks.map((x) => x.minutes));

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/service/team?g=week&d=${d.week.start}`} className="text-sm text-primary hover:underline">← Team</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            {d.person.name} <span className="text-base font-normal text-zinc-500">· {weekLabel(d.week)}</span>
          </h2>
          {!settings && (
            <nav aria-label="Week" className="flex gap-2 text-sm">
              <Link href={href(shiftWeek(d.week.start, -1))} className={stepLink}>← Previous</Link>
              <Link href={`/service/team/${id}`} className={stepLink}>This week</Link>
              <Link href={href(shiftWeek(d.week.start, 1))} className={stepLink}>Next →</Link>
            </nav>
          )}
        </div>
        {d.person.user && <p className="text-sm text-zinc-500">Linked person: {d.person.user.displayName}</p>}
        {(d.profile.designation || d.profile.team) && <p className="text-sm text-zinc-500">{[d.profile.designation, d.profile.team].filter(Boolean).join(" · ")}</p>}
        <p className="mt-1 text-xs text-zinc-500">Reported and tracked hours, not Upwork-verified.</p>
      </div>

      <nav aria-label="Team member sections" className="flex gap-1 border-b border-border-subtle">
        {[
          { id: "overview", label: "Overview", href: `/service/team/${id}` },
          { id: "settings", label: "Settings", href: `/service/team/${id}?view=settings` },
        ].map((t) => {
          const on = (t.id === "settings") === settings;
          return (
            <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-sm ${on ? "border-primary font-medium text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>

      {settings ? (
        <ProfileCard key={`${d.profile.designation}|${d.profile.team}|${d.profile.salary.monthly}|${d.profile.salary.currency}`} id={d.person.id} profile={d.profile} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Hours this week" value={fmtMinutes(d.minutes)} note={fmtDelta(d.minutes, d.previousWeekMinutes)} />
            <Kpi label="Active days" value={`${d.activeDays} of ${d.workingDays}`} note={d.activeDays ? `${fmtMinutes(d.avgPerActiveDay)} per active day` : undefined} />
            <Kpi label="Timer / manual" value={`${fmtMinutes(d.timerMinutes)} / ${fmtMinutes(d.manualMinutes)}`} />
            <Kpi label="Entries to check" value={String(d.flagged)} tone={d.flagged ? WARN : undefined} />
          </div>

          <section aria-labelledby="days" className={SECTION}>
            <h3 id="days" className="font-medium">Day by day</h3>
            <ul className="mt-3 grid grid-cols-7 gap-2 text-center text-xs">
              {d.byDay.map((x) => (
                <li key={x.date} className="space-y-1">
                  <div className="flex h-20 items-end justify-center rounded bg-surface-muted" aria-hidden="true">
                    <div className="w-full rounded bg-primary" style={{ height: `${(x.minutes / busiestDay) * 100}%` }} />
                  </div>
                  <div className="text-zinc-500">{weekday(x.date)}</div>
                  <div className="font-medium">{x.minutes ? fmtMinutes(x.minutes) : "—"}</div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="projects" className={SECTION}>
            <h3 id="projects" className="font-medium">Projects this week</h3>
            {d.byProject.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Nothing logged this week.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Project</th>
                    <th className="py-2 pr-3 font-medium">Client</th>
                    <th className="py-2 pr-3 font-medium">Hours</th>
                    <th className="py-2 font-medium">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {d.byProject.map((x) => (
                    <tr key={`${x.project}${x.client}`}>
                      <td className="py-2 pr-3 font-medium">{x.project}</td>
                      <td className="py-2 pr-3 text-zinc-500">{x.client ?? "—"}</td>
                      <td className="py-2 pr-3">{fmtMinutes(x.minutes)}</td>
                      <td className="py-2">{x.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section aria-labelledby="trend" className={SECTION}>
            <h3 id="trend" className="font-medium">Last {d.weeks.length} weeks</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {d.weeks.map((w) => (
                <li key={w.start} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-zinc-500">{shortDate(w.start)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                    <span className="block h-full bg-primary" style={{ width: `${(w.minutes / busiestWeek) * 100}%` }} />
                  </span>
                  <span className="w-20 shrink-0 text-right font-medium">{fmtMinutes(w.minutes)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent" className={SECTION}>
            <h3 id="recent" className="font-medium">Reports this week</h3>
            {d.recent.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">None.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border-subtle text-sm">
                {d.recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                    <span className="w-14 shrink-0 text-zinc-500">{shortDate(r.entryDate)}</span>
                    <span className="font-medium">{r.project}</span>
                    <span className="font-medium">{fmtMinutes(r.minutes)}</span>
                    <span className="text-xs text-zinc-500">{r.source === "TIMER_CALCULATED" ? "Timer" : "Manual"}</span>
                    {r.flagged && <span className={`text-xs ${WARN}`}>Flagged</span>}
                    {r.memo && <span className="basis-full text-zinc-500 sm:basis-auto">{r.memo}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
