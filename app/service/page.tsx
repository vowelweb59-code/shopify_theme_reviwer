import Link from "next/link";
import type { ReactNode } from "react";
import { connectToDatabase } from "@/lib/db/connect";
import { entriesFor, senderNames, weekParam } from "@/lib/service/api/hours";
import { dmMatch } from "@/lib/service/dm-members";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { limitForWeek, type LimitStep } from "@/lib/service/hours/limit-history";
import { fmtMinutes, fmtUsd, ServiceStatusBadge, weekLabel } from "@/lib/service/ui/format";
import type { ServiceProjectStatus } from "@/models/service-shared";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceTimeEntry } from "@/models/service-time-entry";

export const dynamic = "force-dynamic";

// Service overview, laid out like a BI dashboard (owner, 2026-11-17: "like Power BI / Looker, professional, easy to understand"):
// one filter bar, a strip of four (closed: three) headline numbers for the current filter, then one table. The week figures use the
// same attribution as the project page; "My team only" counts only DM_MEMBERS senders. Earlier decisions kept: hidden tabs, Active
// default, Closed adds review and "Taken from client" (hourly: reported hours x rate; fixed: price; fixed with only a rate: hours x rate).

type Row = {
  _id: string;
  name: string;
  clientId: string | null;
  status: ServiceProjectStatus;
  reviewRating: number | null;
  upworkProfileId: string | null;
  people: Array<{ role: string; name: string }>;
  contract: { type: "HOURLY" | "FIXED"; hourlyRateCents: number | null; weeklyLimitMinutes: number | null; fixedPriceCents: number | null; weeklyLimitHistory?: LimitStep[] } | null;
};

// Every contract made in the old app defaulted to HOURLY, so an hourly contract with no rate and no weekly quote has a type nobody
// chose (owner, 2026-11-16): it shows "Not set", only under All.
type Kind = "hourly" | "fixed" | "unset";
const kindOf = (p: Row): Kind =>
  p.contract?.type === "FIXED" ? "fixed" : p.contract && (p.contract.hourlyRateCents != null || p.contract.weeklyLimitMinutes != null) ? "hourly" : "unset";

const TABS = [
  { id: "timer", label: "Timer", match: (p: Row) => kindOf(p) === "hourly" },
  { id: "fixed", label: "Fixed", match: (p: Row) => kindOf(p) === "fixed" },
  { id: "all", label: "All", match: () => true },
] as const;

const STATUS_TABS = [
  { id: "active", label: "Active", match: (p: Row) => ["NOT_STARTED", "ACTIVE", "BLOCKED", "WAITING_FOR_CLIENT"].includes(p.status) },
  { id: "closed", label: "Closed", match: (p: Row) => ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(p.status) },
  { id: "on_hold", label: "On hold", match: (p: Row) => p.status === "ON_HOLD" },
  { id: "all", label: "All", match: () => true },
] as const;

const href = (tab: string, status: string, teamOnly: boolean) => {
  const q = new URLSearchParams();
  if (tab !== "timer") q.set("tab", tab);
  if (status !== "active") q.set("status", status);
  if (teamOnly) q.set("hours", "team");
  return q.size ? `/service?${q}` : "/service";
};

const h1 = (minutes: number) => (minutes / 60).toLocaleString("en-IN", { maximumFractionDigits: 1 });

function Segments({ label, items }: { label: string; items: Array<{ to: string; text: string; on: boolean; count?: number }> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-border-subtle">
        {items.map((i) => (
          <Link
            key={i.text}
            href={i.to}
            aria-current={i.on ? "page" : undefined}
            className={`border-r border-border-subtle px-3 py-1.5 text-sm last:border-r-0 ${i.on ? "bg-primary-tint font-medium text-primary-tint-text" : "bg-surface text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`}
          >
            {i.text}
            {i.count !== undefined && <span className="ml-1.5 tabular-nums text-zinc-500">{i.count}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${tone === "warn" ? "text-status-warning-text" : "text-zinc-950 dark:text-zinc-50"}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

/** This week's hours against the weekly quota: figures plus a thin bar (red once over). */
function WeekCell({ minutes, limit }: { minutes: number; limit: number | null }) {
  if (limit === null) return <span className="tabular-nums">{minutes ? fmtMinutes(minutes) : "—"}</span>;
  const pct = limit ? Math.min(100, (minutes / limit) * 100) : 0;
  const over = minutes > limit;
  return (
    <div className="ml-auto w-36">
      <div className="flex justify-between text-xs tabular-nums">
        <span className={over ? "font-medium text-status-fail-text" : undefined}>{fmtMinutes(minutes)}</span>
        <span className="text-zinc-500">of {h1(limit)}h</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className={`h-full ${over ? "bg-status-fail-icon" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function ServiceOverviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; hours?: string }> }) {
  const sp = await searchParams;
  const teamOnly = sp.hours === "team";
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const status = STATUS_TABS.find((s) => s.id === sp.status) ?? STATUS_TABS[0];
  await connectToDatabase();
  const [all, profiles, att, names] = await Promise.all([
    ServiceProject.find().select("name clientId status reviewRating contract upworkProfileId people").sort({ name: 1 }).lean<Row[]>(),
    ServiceUpworkProfile.find().select("name").lean<Array<{ _id: string; name: string }>>(),
    loadAttribution(),
    senderNames(),
  ]);
  const profileName = new Map(profiles.map((x) => [x._id, x.name]));
  const who = (p: Row, role: string) => p.people.filter((x) => x.role === role).map((x) => x.name).join(", ");
  const ofType = all.filter(tab.match);
  const projects = ofType.filter(status.match);
  const counts = (s: (typeof STATUS_TABS)[number]) => ofType.filter(s.match).length;

  // Hours reported this week per project (the same placement as the project page).
  const week = weekParam(null);
  const countsFor = (sender: string) => !teamOnly || dmMatch(names.get(sender)) !== null;
  const thisWeek = new Map<string, number>();
  for (const e of await entriesFor("ANY", week)) {
    const pid = projectOf(e, att.owner);
    if (pid && countsFor(e.senderExternalId)) thisWeek.set(pid, (thisWeek.get(pid) ?? 0) + e.minutes);
  }
  const limitOf = (p: Row) => (p.contract ? limitForWeek(p.contract.weeklyLimitHistory ?? [], p.contract.weeklyLimitMinutes, week.end) : null);

  // Closed projects: what we took from the client, from all reported hours.
  const showMoney = status.id === "closed";
  const minutes = new Map<string, number>();
  if (showMoney) {
    const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
      .select("projectId clientId minutes allocations senderExternalId")
      .lean<Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }>; senderExternalId: string }>>();
    for (const e of expandAllocations(entries)) {
      if (!countsFor(e.senderExternalId)) continue;
      const pid = projectOf(e, att.owner);
      if (pid) minutes.set(pid, (minutes.get(pid) ?? 0) + e.minutes);
    }
  }
  /** Cents taken from the client, or null when it cannot be worked out (no rate / no price entered). */
  const takenCents = (p: Row): number | null => {
    const c = p.contract;
    if (!c) return null;
    if (c.type === "FIXED" && c.fixedPriceCents != null) return c.fixedPriceCents;
    return c.hourlyRateCents != null ? Math.round(((minutes.get(p._id) ?? 0) / 60) * c.hourlyRateCents) : null;
  };

  // Headline numbers.
  const activeOfType = ofType.filter(STATUS_TABS[0].match);
  const weekMinutes = projects.reduce((n, p) => n + (thisWeek.get(p._id) ?? 0), 0);
  const quotaMinutes = projects.reduce((n, p) => n + (limitOf(p) ?? 0), 0);
  const overQuota = projects.filter((p) => { const l = limitOf(p); return l !== null && (thisWeek.get(p._id) ?? 0) > l; }).length;
  const totalTaken = showMoney ? projects.reduce((n, p) => n + (takenCents(p) ?? 0), 0) : 0;
  const rated = projects.filter((p) => p.reviewRating != null);
  const avgReview = rated.length ? rated.reduce((n, p) => n + p.reviewRating!, 0) / rated.length : null;
  const th = "px-4 py-2.5 font-medium";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border-subtle bg-surface px-4 py-3">
        <Segments label="Type" items={TABS.map((t) => ({ to: href(t.id, status.id, teamOnly), text: t.label, on: t.id === tab.id }))} />
        <Segments label="Status" items={STATUS_TABS.map((s) => ({ to: href(tab.id, s.id, teamOnly), text: s.label, on: s.id === status.id, count: counts(s) }))} />
        <Segments
          label="Hours of"
          items={[
            { to: href(tab.id, status.id, false), text: "Everyone", on: !teamOnly },
            { to: href(tab.id, status.id, true), text: "My team only", on: teamOnly },
          ]}
        />
      </div>

      {showMoney ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Closed projects" value={projects.length.toLocaleString("en-IN")} />
          <Kpi label="Average closing review" value={avgReview !== null ? <><span className="text-status-warning-icon">★</span> {avgReview.toFixed(1)}</> : "—"} note={`${rated.length} of ${projects.length} have a review`} />
          <Kpi label="Taken from clients" value={fmtUsd(totalTaken)} note="Hourly: hours × rate. Fixed: the price. No rate or price counts as nothing." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Active projects" value={activeOfType.length.toLocaleString("en-IN")} />
          <Kpi label="On hold" value={counts(STATUS_TABS[2]).toLocaleString("en-IN")} />
          <Kpi
            label={`Hours this week · ${weekLabel(week)}`}
            value={fmtMinutes(weekMinutes)}
            note={quotaMinutes ? `of ${h1(quotaMinutes)}h weekly quota · ${Math.round((weekMinutes / quotaMinutes) * 100)}%` : "No weekly quota set"}
          />
          <Kpi label="Over weekly quota" value={overQuota.toLocaleString("en-IN")} tone={overQuota ? "warn" : undefined} note={overQuota ? "projects past their quota this week" : "none this week"} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className={th}>Project</th>
              <th className={th}>BA / BD</th>
              <th className={th}>Type</th>
              <th className={`${th} text-right`}>This week</th>
              {showMoney ? <th className={`${th} text-right`}>Review</th> : <th className={th}>Status</th>}
              {showMoney && <th className={`${th} text-right`}>Taken</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {projects.length === 0 && (
              <tr>
                <td colSpan={showMoney ? 6 : 5} className="px-4 py-8 text-center text-zinc-500">No projects match these filters.</td>
              </tr>
            )}
            {projects.map((p) => {
              const c = p.contract;
              const kind = kindOf(p);
              const ba = who(p, "BUSINESS_ANALYST");
              const bd = who(p, "BUSINESS_DEVELOPER");
              return (
                <tr key={p._id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/service/projects/${p._id}`} className="font-medium text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">{p.name}</Link>
                    <div className="text-xs text-zinc-500">{(p.upworkProfileId && profileName.get(p.upworkProfileId)) || "No profile"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                    <div>{ba || "—"}</div>
                    <div className="text-xs text-zinc-500">{bd || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {!c ? (
                      <span className="text-zinc-400">No contract</span>
                    ) : kind === "fixed" ? (
                      <>
                        <div>Fixed</div>
                        <div className="text-xs text-zinc-500">{c.fixedPriceCents != null ? fmtUsd(c.fixedPriceCents) : "no price"}</div>
                      </>
                    ) : kind === "hourly" ? (
                      <>
                        <div>Hourly</div>
                        <div className="text-xs tabular-nums text-zinc-500">{c.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "no rate"}</div>
                      </>
                    ) : (
                      <span className="text-status-warning-text" title="No rate or weekly quota entered: open the project to set Fixed or Hourly">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right"><WeekCell minutes={thisWeek.get(p._id) ?? 0} limit={limitOf(p)} /></td>
                  {showMoney ? (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.reviewRating != null ? <span title={`${p.reviewRating.toFixed(1)} out of 5`}><span className="text-status-warning-icon">★</span> {p.reviewRating.toFixed(1)}</span> : "—"}
                    </td>
                  ) : (
                    <td className="px-4 py-2.5"><ServiceStatusBadge status={p.status} /></td>
                  )}
                  {showMoney && <td className="px-4 py-2.5 text-right tabular-nums">{takenCents(p) != null ? fmtUsd(takenCents(p)!) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Reported hours from the TIMER STATUS space, not Upwork-verified. {teamOnly ? "Only your Digital Marketing team's reports are counted." : "Everyone on a project counts."}</p>
    </div>
  );
}
