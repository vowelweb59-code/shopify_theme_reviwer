import Link from "next/link";
import { load } from "@/lib/service/api/http";
import { departmentsReport } from "@/lib/service/api/reports";
import { fmtMinutes } from "@/lib/service/ui/format";
import { fmtDeltaPeriod, type Period } from "@/lib/service/ui/period";
import { Kpi, LINK, Overview, SECTION, TH, THEAD, WARN } from "./kpi";

export async function DepartmentsTab({ period }: { period: Period }) {
  const r = await load(() => departmentsReport({ from: period.from, to: period.to }));
  const o = r.overview;

  return (
    <div className="space-y-6">
      <Overview title="Departments overview">
        <Kpi label="Hours" value={fmtMinutes(o.minutes)} note={fmtDeltaPeriod(o.minutes, o.previousMinutes, fmtMinutes)} />
        <Kpi label="Departments" value={String(o.departments)} note={`${o.departmentsWithHours} with hours`} />
        <Kpi label="Top department" value={o.top ? o.top.name : "—"} note={o.top ? `${fmtMinutes(o.top.minutes)}${o.minutes ? `, ${Math.round((o.top.minutes / o.minutes) * 100)}% of hours` : ""}` : undefined} />
        {o.noManagerSet > 0 && <Kpi label="Departments without a manager" value={String(o.noManagerSet)} tone={WARN} />}
      </Overview>

      <section aria-labelledby="depts" className={SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="depts" className="font-medium">Department wise report</h2>
          <Link href="/service/departments" className="text-sm text-primary hover:underline">Manage departments →</Link>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Reported and tracked hours, not Upwork-verified. A project belongs to the department of its project manager; projects with no matching manager go to the default department.
        </p>
        {r.departments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No departments yet. <Link href="/service/departments" className={LINK}>Create them</Link> to see this report.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className={THEAD}>
                <tr className="border-b border-border-subtle text-left">
                  <th className={TH}>Department</th>
                  <th className={`${TH} text-right`}>Hours</th>
                  <th className={`${TH} w-32`}>Share</th>
                  <th className={`${TH} text-right`}>Projects</th>
                  <th className={TH}>People</th>
                  <th className={`${TH} text-right`}>Per person</th>
                  <th className={TH}>Top projects</th>
                  <th className="py-2 text-right font-medium">To check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle align-top">
                {r.departments.map((d) => (
                  <tr key={d.id ?? "none"}>
                    <td className="py-2 pr-3">
                      <div className={`font-medium ${d.id ? "" : "text-zinc-500"}`}>{d.name}</div>
                      <div className="text-xs text-zinc-500">{d.isDefault ? "Default: every other project" : d.manager ? `Manager: ${d.manager}` : d.id ? "No manager set" : "Unknown client or in-house"}</div>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">
                      <div className="font-medium">{fmtMinutes(d.minutes)}</div>
                      <div className="text-xs text-zinc-500">{fmtDeltaPeriod(d.minutes, d.previousMinutes, fmtMinutes)}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                        <div className="h-full bg-primary" style={{ width: `${o.minutes ? (d.minutes / o.minutes) * 100 : 0}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {o.minutes ? Math.round((d.minutes / o.minutes) * 100) : 0}% · timer {d.minutes ? Math.round((d.timerMinutes / d.minutes) * 100) : 0}%
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{d.projectCount}</td>
                    <td className="py-2 pr-3">
                      {d.activePeople}
                      <div className="text-xs text-zinc-500">
                        {d.people.slice(0, 3).map((x) => x.name).join(", ")}
                        {d.people.length > 3 && ` +${d.people.length - 3}`}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{d.activePeople ? fmtMinutes(d.avgPerPerson) : "—"}</td>
                    <td className="py-2 pr-3 text-xs">{d.projects.slice(0, 3).map((x) => `${x.name} ${fmtMinutes(x.minutes)}`).join(" · ") || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{d.flagged > 0 ? <span className={WARN}>{d.flagged}</span> : <span className="text-zinc-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
