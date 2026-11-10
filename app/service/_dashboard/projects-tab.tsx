import Link from "next/link";
import { load } from "@/lib/service/api/http";
import { liveReports } from "@/lib/service/api/hours";
import { projectsReport, type Kind } from "@/lib/service/api/reports";
import { fmtMinutes, fmtUsd, HoursBar, ServiceStatusBadge } from "@/lib/service/ui/format";
import { fmtDeltaPeriod, type Period } from "@/lib/service/ui/period";
import type { ServiceProjectStatus } from "@/models/service-shared";
import { BAD, Kpi, LINK, Overview, SECTION, TH, THEAD, WARN } from "./kpi";
import { dashHref } from "./period-bar";

export const KIND_TABS = [
  { id: "direct", label: "Direct Projects", hint: "Clients who pay directly, not through Upwork" },
  { id: "fixed", label: "Fixed Projects", hint: "Fixed-price contracts" },
  { id: "timer", label: "Timer Projects", hint: "Hourly Upwork projects" },
] as const satisfies ReadonlyArray<{ id: Kind; label: string; hint: string }>;
export type KindId = (typeof KIND_TABS)[number]["id"];

const dash = <span className="text-zinc-400">—</span>;

export async function ProjectsTab({ period, showAll, kind }: { period: Period; showAll: boolean; kind: KindId }) {
  const [r, live] = await Promise.all([load(() => projectsReport({ from: period.from, to: period.to, all: showAll, kind })), load(() => liveReports("15"))]);
  const o = r.overview;
  const showAmount = r.rows.some((x) => x.amountCents !== null);
  const idle = r.rows.filter((x) => x.minutes === 0 && x.active);
  const label = KIND_TABS.find((k) => k.id === kind)!.label;

  return (
    <div className="space-y-6">
      <nav aria-label="Project kind" className="flex flex-wrap gap-2">
        {KIND_TABS.map((k) => (
          <Link
            key={k.id}
            href={dashHref("projects", period, `&kind=${k.id}${showAll ? "&all=1" : ""}`)}
            aria-current={kind === k.id ? "page" : undefined}
            title={k.hint}
            className={`rounded-md border px-3 py-1.5 text-sm ${kind === k.id ? "border-primary bg-primary font-medium text-primary-foreground" : "border-border-subtle hover:bg-surface-muted"}`}
          >
            {k.label} <span className={kind === k.id ? "opacity-80" : "text-zinc-500"}>({r.kinds[k.id]})</span>
          </Link>
        ))}
      </nav>

      <Overview title={`${label} overview`}>
        <Kpi label="Hours" value={fmtMinutes(o.minutes)} note={fmtDeltaPeriod(o.minutes, o.previousMinutes, fmtMinutes)} />
        <Kpi label="Clients with hours" value={String(o.activeClients)} note={`of ${r.rows.length} active`} />
        {r.weekMode ? (
          <Kpi label="Over the weekly limit" value={String(o.overLimit)} tone={o.overLimit ? BAD : undefined} />
        ) : (
          <Kpi label="Quiet this period" value={String(idle.length)} note="active, but no hours logged" tone={idle.length ? WARN : undefined} />
        )}
        <Kpi label="Flagged entries" value={String(o.flagged)} tone={o.flagged ? WARN : undefined} note="waiting on the Review page" />
        <Kpi label="In-house work" value={fmtMinutes(o.inHouseMinutes)} />
        <Kpi label="Not on a project yet" value={fmtMinutes(o.unassignedMinutes)} note="client unknown, or which of its projects is unclear" />
      </Overview>

      <section aria-labelledby="proj" className={SECTION}>
        <h2 id="proj" className="font-medium">{label}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Reported and tracked hours, not Upwork-verified. {showAll ? "Showing every client." : "Showing every active project, including those with no hours this period."}
          {!r.weekMode && " Weekly limits show when a single Monday–Sunday week is selected."}
        </p>
        {r.rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">{showAll ? "No projects yet." : "No active projects of this kind."}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className={THEAD}>
                <tr className="border-b border-border-subtle text-left">
                  <th className={TH}>Project</th>
                  <th className={`${TH} text-right`}>Hours</th>
                  {showAmount && <th className={`${TH} text-right`} title="Hours worked times the hourly rate">Amount</th>}
                  {r.weekMode && <th className={`${TH} w-36`}>Of weekly limit</th>}
                  {r.weekMode && <th className={`${TH} text-right`}>Left this week</th>}
                  <th className={`${TH} text-right`}>Timer</th>
                  <th className={`${TH} text-right`}>Manual</th>
                  <th className={`${TH} text-right`}>Days worked</th>
                  <th className="py-2 font-medium">Needs attention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {r.rows.map((x) => (
                  <tr key={x.projectId} className="hover:bg-surface-muted/60">
                    <td className="py-2 pr-3">
                      <Link href={`/service/projects/${x.projectId}`} className={LINK}>{x.projectName}</Link>
                      {x.inHouse && <span className="ml-1 text-xs text-zinc-500">(in-house)</span>}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums">
                      {fmtMinutes(x.minutes)}
                      {x.weekly?.limitMinutes ? <span className="font-normal text-zinc-500"> / {fmtMinutes(x.weekly.limitMinutes)}</span> : null}
                    </td>
                    {showAmount && <td className="py-2 pr-3 text-right tabular-nums">{x.amountCents != null ? fmtUsd(x.amountCents) : dash}</td>}
                    {r.weekMode && (
                      <td className="py-2 pr-3">
                        {x.weekly?.limitMinutes ? (
                          <div className="space-y-1">
                            <HoursBar hours={{ limitMinutes: x.weekly.limitMinutes, completedMinutes: x.minutes, overLimitMinutes: x.weekly.overLimitMinutes }} />
                            <span className="text-xs text-zinc-500">{x.weekly.percentUsed}%</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">No limit set</span>
                        )}
                      </td>
                    )}
                    {r.weekMode && (
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {x.weekly?.overLimitMinutes ? <span className={BAD}>Over by {fmtMinutes(x.weekly.overLimitMinutes)}</span> : x.weekly?.remainingMinutes == null ? "—" : fmtMinutes(x.weekly.remainingMinutes)}
                      </td>
                    )}
                    <td className="py-2 pr-3 text-right tabular-nums">{x.timerMinutes ? fmtMinutes(x.timerMinutes) : dash}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{x.manualMinutes ? fmtMinutes(x.manualMinutes) : dash}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{x.activeDays}</td>
                    <td className="py-2 text-xs">{x.flagged > 0 && <span className={WARN}>{x.flagged} to check</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-zinc-500">
          {showAll ? (
            <Link href={dashHref("projects", period, `&kind=${kind}`)} className={LINK}>Hide inactive clients</Link>
          ) : r.hiddenInactive > 0 ? (
            <>
              {r.hiddenInactive} inactive {r.hiddenInactive === 1 ? "client is" : "clients are"} hidden.{" "}
              <Link href={dashHref("projects", period, `&kind=${kind}&all=1`)} className={LINK}>Show all</Link>
            </>
          ) : null}
        </p>
      </section>

      <section aria-labelledby="live" className={SECTION}>
        <h2 id="live" className="font-medium">Latest reports</h2>
        <p className="mt-1 text-xs text-zinc-500">The newest hours from Chat. They already count toward the figures above; only flagged ones wait on the Review page.</p>
        {live.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No reports yet. Import a month on the <Link href="/service/chat" className={LINK}>Chat sync</Link> page.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className={THEAD}>
                <tr className="border-b border-border-subtle text-left">
                  <th className={TH}>Date</th>
                  <th className={TH}>Person</th>
                  <th className={TH}>Client</th>
                  <th className={TH}>Hours</th>
                  <th className={TH}>Type</th>
                  <th className="py-2 font-medium">Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {live.map((x) => (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap py-2 pr-3">{new Date(`${x.entryDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{x.sender}</td>
                    <td className="py-2 pr-3">
                      {x.client ?? <span className="text-zinc-500">No client</span>}
                      {x.inHouse && <span className="ml-1 text-xs text-zinc-500">(in-house)</span>}
                      {x.project && x.project !== x.client && <div className="text-xs text-zinc-500">{x.project}</div>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 font-medium">{fmtMinutes(x.minutes)}</td>
                    <td className="py-2 pr-3">{x.source === "TIMER_CALCULATED" ? "Timer" : "Manual"}</td>
                    <td className="max-w-md py-2 text-zinc-500">
                      <span className="line-clamp-2">{x.memo}</span>
                      {x.flagged && <span className={`text-xs ${WARN}`}>Flagged</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {r.attention.length > 0 && (
        <section aria-labelledby="needs" className={SECTION}>
          <h2 id="needs" className="font-medium">Needs attention</h2>
          <ul className="mt-3 divide-y divide-border-subtle">
            {r.attention.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/service/projects/${p.id}`} className={LINK}>{p.name}</Link>
                <ServiceStatusBadge status={p.status as ServiceProjectStatus} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
