import Link from "next/link";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connect";
import { loadPerformance } from "@/lib/service/performance/load";
import { fmtLongDay, fmtMinutes, fmtUsd, ServiceStatusBadge, weekLabel } from "@/lib/service/ui/format";
import type { ServiceProjectStatus } from "@/models/service-shared";
import { Meter, Stat, occupancyState, stars } from "../_components/PerfBits";

export const dynamic = "force-dynamic";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// One team member's whole record (owner, 2026-11-20): hours, value earned over time, projects handled, average review rating (weighted by the
// hours on each reviewed project, with the number of reviews), this week's occupancy, and month by month.
export default async function MemberPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ on?: string }> }) {
  const { slug } = await params;
  const { on } = await searchParams;
  await connectToDatabase();
  const data = await loadPerformance(on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : null);
  const m = data.members.find((x) => x.slug === slug);
  if (!m) notFound();
  const { week } = data;
  const st = occupancyState(m.occupancy);
  const months = Object.entries(m.byMonth).sort((a, b) => b[0].localeCompare(a[0]));
  const monthMax = Math.max(0, ...months.map(([, v]) => v.minutes));
  const th = "px-4 py-2.5 font-medium";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/service/performance/members" className="text-sm text-primary hover:underline">
          ← Members
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{m.name}</h2>
          {m.left ? (
            <span className="rounded-full bg-status-not-tested-bg px-2.5 py-0.5 text-xs font-medium text-status-not-tested-text">Left the company</span>
          ) : !m.active ? (
            <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-text">
              Inactive: no report in 2 months
            </span>
          ) : (
            <span className="rounded-full bg-status-pass-bg px-2.5 py-0.5 text-xs font-medium text-status-pass-text">Active</span>
          )}
          {m.designation && <span className="text-sm text-zinc-500">{m.designation}</span>}
        </div>
        <p className="mt-1 text-sm text-zinc-500">{m.lastReport ? `Last report ${fmtLongDay(m.lastReport)}` : "No reports yet"} · Digital Marketing team</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total value earned"
          value={fmtUsd(m.valueCents)}
          note={m.unpricedMinutes > 0 ? `+ ${fmtMinutes(m.unpricedMinutes)} on projects with no rate` : "hours × each project's rate"}
        />
        <Stat label="Hours worked" value={fmtMinutes(m.totalMinutes)} note={`${months.length} month${months.length === 1 ? "" : "s"} of reports`} />
        <Stat label="Projects handled" value={String(m.projectsHandled)} note={`${m.projectsNow} running now`} />
        <Stat
          label="Average review"
          value={stars(m.weightedRating)}
          note={
            m.scoredProjects
              ? `${m.ratedProjects} of ${m.scoredProjects} projects reviewed · no review counts as 3.5★, 5★ and 1–2★ weigh more; cancelled and not started projects are left out`
              : "no projects yet"
          }
        />
      </div>

      <section className="space-y-3 rounded-lg border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">
            This week <span className="font-normal text-zinc-500">· {weekLabel(week)}</span>
          </h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.tone}`}>{st.label}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex justify-between text-sm">
              <span>Occupied by allocation</span>
              <span className="tabular-nums text-zinc-500">
                {fmtMinutes(m.allocatedMinutes)} of {fmtMinutes(m.capacityMinutes)} · {Math.round(m.occupancy * 100)}%
              </span>
            </div>
            <div className="mt-1">
              <Meter value={m.allocatedMinutes} max={m.capacityMinutes} over={m.occupancy > 1} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span>Completed so far</span>
              <span className="tabular-nums text-zinc-500">
                {fmtMinutes(m.weekMinutes)}
                {m.allocatedMinutes ? ` of ${fmtMinutes(m.allocatedMinutes)} · ${Math.round((m.weekMinutes / m.allocatedMinutes) * 100)}%` : ""}
              </span>
            </div>
            <div className="mt-1">
              <Meter value={m.weekMinutes} max={m.allocatedMinutes || m.capacityMinutes} tone="bg-status-pass-icon" />
            </div>
          </div>
        </div>
      </section>

      {m.projects.some((p) => p.allocatedMinutes > 0) && (
        <section className="rounded-lg border border-border-subtle bg-surface">
          <h3 className="px-4 pt-4 font-medium">
            Allocation{" "}
            <span className="font-normal text-zinc-500">
              · the usual {fmtMinutes(m.allocatedMinutes)} a week: hours reported in the last 4 weeks / 4, by project
            </span>
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className={th}>Project</th>
                  <th className={`${th} text-right`}>Team&apos;s usual week</th>
                  <th className={`${th} text-right`}>Share of the project&apos;s last 4 weeks</th>
                  <th className={`${th} text-right`}>Allocated a week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {m.projects
                  .filter((p) => p.allocatedMinutes > 0)
                  .sort((a, b) => b.allocatedMinutes - a.allocatedMinutes)
                  .map((p) => (
                    <tr key={p.projectId}>
                      <td className="px-4 py-2.5">
                        <Link href={`/service/projects/${p.projectId}`} className="font-medium hover:text-primary hover:underline">
                          {data.projectInfo.get(p.projectId)?.name ?? "Unknown project"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMinutes(p.weeklyMinutes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(p.share * 100)}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtMinutes(p.allocatedMinutes)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border-subtle bg-surface">
        <h3 className="px-4 pt-4 font-medium">
          Projects handled <span className="font-normal text-zinc-500">· most hours first</span>
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className={th}>Project</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Hours</th>
                <th className={`${th} text-right`}>Value earned</th>
                <th className={`${th} text-right`}>Review</th>
                <th className={`${th} text-right`}>Last report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {m.projects.map((p) => {
                const info = data.projectInfo.get(p.projectId);
                return (
                  <tr key={p.projectId} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/service/projects/${p.projectId}`}
                        className="font-medium text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100"
                      >
                        {info?.name ?? "Unknown project"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{info && <ServiceStatusBadge status={info.status as ServiceProjectStatus} />}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtMinutes(p.minutes)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.valueCents ? (
                        fmtUsd(p.valueCents)
                      ) : info && info.hourlyRateCents === null && !info.fixed ? (
                        <span className="text-zinc-400" title="No rate on this project">
                          no rate
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{stars(p.rating)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-500">{fmtLongDay(p.lastReport)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-surface">
        <h3 className="px-4 pt-4 font-medium">
          By month <span className="font-normal text-zinc-500">· newest first</span>
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className={th}>Month</th>
                <th className={th}>Hours</th>
                <th className={`${th} text-right`}>Value earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {months.map(([month, v]) => (
                <tr key={month}>
                  <td className="px-4 py-2.5">{monthLabel(month)}</td>
                  <td className="w-72 px-4 py-2.5">
                    <div className="tabular-nums">{fmtMinutes(v.minutes)}</div>
                    <div className="mt-1">
                      <Meter value={v.minutes} max={monthMax} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtUsd(v.valueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-zinc-500">
        Reported hours, not Upwork-verified. Hours on a project count for every member who reported them; a review counts for each member by their hours on that
        project.
      </p>
    </div>
  );
}
