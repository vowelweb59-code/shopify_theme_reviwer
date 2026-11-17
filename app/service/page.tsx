import Link from "next/link";
import type { ReactNode } from "react";
import { connectToDatabase } from "@/lib/db/connect";
import { entriesFor, senderNames } from "@/lib/service/api/hours";
import { dmMatch } from "@/lib/service/dm-members";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { STANDARD_RATE_CENTS, workableMinutes } from "@/lib/service/hours/fixed-budget";
import { limitForPeriod, type LimitStep } from "@/lib/service/hours/limit-history";
import { istDate } from "@/lib/service/import/text";
import { weekOf } from "@/lib/service/import/week";
import { fmtMinutes, fmtUsd, shiftWeek, weekLabel } from "@/lib/service/ui/format";
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

/** The period being looked at: a Monday-to-Sunday week or a calendar month (owner, 2026-11-17: look back at any past week or month). */
type Per = { by?: "month"; on?: string };
const href = (tab: string, status: string, teamOnly: boolean, per: Per = {}) => {
  const q = new URLSearchParams();
  if (tab !== "timer") q.set("tab", tab);
  if (status !== "active") q.set("status", status);
  if (teamOnly) q.set("hours", "team");
  if (per.by) q.set("by", per.by);
  if (per.on) q.set("on", per.on);
  return q.size ? `/service?${q}` : "/service";
};
const isoDay = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null);
const monthBounds = (anchor: string) => {
  const [y, m] = anchor.split("-").map(Number);
  return { start: `${anchor.slice(0, 7)}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
};
const shiftMonth = (anchor: string, by: number) => { const [y, m] = anchor.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10); };

const h1 = (minutes: number) => (minutes / 60).toLocaleString("en-IN", { maximumFractionDigits: 1 });

/** Small segmented switch (Type). */
function Segments({ items }: { items: Array<{ to: string; text: string; on: boolean }> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-border-subtle">
        {items.map((i) => (
          <Link
            key={i.text}
            href={i.to}
            aria-current={i.on ? "page" : undefined}
            className={`border-r border-border-subtle px-3 py-1.5 text-sm last:border-r-0 ${i.on ? "bg-primary-tint font-medium text-primary-tint-text" : "bg-surface text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`}
          >
            {i.text}
          </Link>
        ))}
      </div>
    </div>
  );
}

const DOT: Record<string, string> = { active: "bg-status-pass-icon", closed: "bg-status-info-icon", on_hold: "bg-status-warning-icon", all: "bg-status-not-tested-icon" };

/** Underlined tabs with a colour dot and a count pill (Status): the main filter. */
function Tabs({ items }: { items: Array<{ id: string; to: string; text: string; on: boolean; count: number }> }) {
  return (
    <nav aria-label="Project status" className="flex gap-5">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.to}
          aria-current={i.on ? "page" : undefined}
          className={`-mb-px flex items-center gap-2 border-b-2 pb-2 text-sm ${i.on ? "border-primary font-medium text-primary-tint-text" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
        >
          <span className={`h-2 w-2 rounded-full ${DOT[i.id]}`} aria-hidden="true" />
          {i.text}
          <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${i.on ? "bg-primary-tint text-primary-tint-text" : "bg-surface-muted text-zinc-500"}`}>{i.count}</span>
        </Link>
      ))}
    </nav>
  );
}

const ACCENT = {
  primary: { bar: "border-l-primary", value: "text-primary-tint-text" },
  pass: { bar: "border-l-status-pass-icon", value: "text-status-pass-text" },
  warn: { bar: "border-l-status-warning-icon", value: "text-status-warning-text" },
  info: { bar: "border-l-status-info-icon", value: "text-status-info-text" },
  fail: { bar: "border-l-status-fail-icon", value: "text-status-fail-text" },
} as const;

function Kpi({ label, value, note, accent }: { label: string; value: ReactNode; note?: ReactNode; accent: keyof typeof ACCENT }) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-lg border border-l-4 border-border-subtle ${a.bar} bg-surface p-4`}>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${a.value}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

/** This week's hours against the weekly quota: figures plus a thin bar (red once over). */
function WeekCell({ minutes, limit, unit = "wk" }: { minutes: number; limit: number | null; unit?: "wk" | "total" }) {
  if (limit === null) return <span className="tabular-nums">{minutes ? fmtMinutes(minutes) : "—"}</span>;
  const pct = limit ? Math.min(100, (minutes / limit) * 100) : 0;
  const over = minutes > limit;
  const bar = over ? "bg-status-fail-icon" : pct >= 80 ? "bg-status-warning-icon" : "bg-status-pass-icon";
  return (
    <div className="ml-auto w-36">
      <div className="flex justify-between text-xs tabular-nums">
        <span className={over ? "font-medium text-status-fail-text" : undefined}>{fmtMinutes(minutes)}</span>
        <span className="text-zinc-500">of {h1(limit)}h{unit === "total" ? " total" : ""}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Revenue achieved against the scope of work, in dollars, with the same thin bar as the hours. */
function MoneyCell({ cents, scope }: { cents: number; scope: number | null }) {
  if (scope === null) return <span className="tabular-nums">{cents ? fmtUsd(cents) : "—"}</span>;
  const pct = scope ? Math.min(100, (cents / scope) * 100) : 0;
  const over = cents > scope;
  const bar = over ? "bg-status-fail-icon" : pct >= 80 ? "bg-status-warning-icon" : "bg-status-pass-icon";
  return (
    <div className="ml-auto w-36">
      <div className="flex justify-between text-xs tabular-nums">
        <span className={over ? "font-medium text-status-fail-text" : undefined}>{fmtUsd(cents)}</span>
        <span className="text-zinc-500">of {fmtUsd(scope)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function ServiceOverviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; hours?: string; by?: string; on?: string }> }) {
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

  // Hours reported in the chosen period per project (the same placement as the project page); the period is the current week unless
  // ?by=month or ?on=YYYY-MM-DD (any day inside the week / month wanted) is given.
  const today = istDate(new Date());
  const anchor = isoDay(sp.on) ?? today;
  const byMonth = sp.by === "month";
  const week = byMonth ? monthBounds(anchor) : weekOf(anchor);
  const isCurrent = today >= week.start && today <= week.end;
  const per: Per = { by: byMonth ? "month" : undefined, on: isoDay(sp.on) ?? undefined };
  const periodName = byMonth ? new Date(`${week.start}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : weekLabel(week);
  const unit = byMonth ? "month" : "week";
  const prevOn = byMonth ? shiftMonth(anchor, -1) : shiftWeek(week.start, -1);
  const nextOn = byMonth ? shiftMonth(anchor, 1) : shiftWeek(week.start, 1);
  const h = (t: string, st: string, tm: boolean, p: Per = per) => href(t, st, tm, p);
  const countsFor = (sender: string) => !teamOnly || dmMatch(names.get(sender)) !== null;
  const thisWeek = new Map<string, number>();
  for (const e of await entriesFor("ANY", week)) {
    const pid = projectOf(e, att.owner);
    if (pid && countsFor(e.senderExternalId)) thisWeek.set(pid, (thisWeek.get(pid) ?? 0) + e.minutes);
  }
  const limitOf = (p: Row) => (p.contract ? limitForPeriod(p.contract.weeklyLimitHistory ?? [], p.contract.weeklyLimitMinutes, week.start, week.end) : null);

  // Closed projects: what we took from the client, from all reported hours.
  const showMoney = status.id === "closed";
  const minutes = new Map<string, number>();
  // All-time hours are needed for Closed (money) and for fixed-price projects (hours used against the workable total).
  if (showMoney || projects.some((p) => kindOf(p) === "fixed")) {
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
  // Fixed-price projects: workable hours = price / $15; hourly projects: this week's quota.
  // A fixed project that also has an hourly rate is billed by the hours worked (owner, 2026-11-17: Richard Mintz started at $250, the
  // scope grew and it is now charged at $15/h): no workable-hours cap, revenue = hours x that rate.
  const billedByHours = (p: Row) => kindOf(p) === "fixed" && p.contract?.hourlyRateCents != null;
  const fixedBudget = (p: Row) => (kindOf(p) === "fixed" && !billedByHours(p) ? workableMinutes(p.contract?.fixedPriceCents) : null);
  const quotaMinutes = projects.reduce((n, p) => n + (fixedBudget(p) === null ? limitOf(p) ?? 0 : 0), 0);
  // Amounts (owner, 2026-11-17: "revenue generated, total scope of work in amount and how much achieved, like the hours"):
  // hourly = this week's hours x the hourly rate against the weekly quota x the rate; fixed = hours used x $15 against the fixed price.
  const rateOf = (p: Row) => (kindOf(p) === "fixed" && !billedByHours(p) ? STANDARD_RATE_CENTS : p.contract?.hourlyRateCents ?? null);
  const scopeCents = (p: Row): number | null => {
    if (kindOf(p) === "fixed") return billedByHours(p) ? null : p.contract?.fixedPriceCents ?? null;
    const l = limitOf(p);
    const r = rateOf(p);
    return l !== null && r !== null ? Math.round((l / 60) * r) : null;
  };
  const achievedCents = (p: Row): number => {
    const r = rateOf(p);
    if (r === null) return 0;
    const m = kindOf(p) === "fixed" ? minutes.get(p._id) ?? 0 : thisWeek.get(p._id) ?? 0;
    return Math.round((m / 60) * r);
  };
  const hourlyInView = projects.filter((p) => kindOf(p) === "hourly");
  const revenueWeek = hourlyInView.reduce((n, p) => n + achievedCents(p), 0);
  const scopeWeek = hourlyInView.reduce((n, p) => n + (scopeCents(p) ?? 0), 0);
  const fixedWeekCents = projects.filter((p) => kindOf(p) === "fixed").reduce((n, p) => n + Math.round(((thisWeek.get(p._id) ?? 0) / 60) * (rateOf(p) ?? 0)), 0);
  const overQuota = projects.filter((p) => {
    const f = fixedBudget(p);
    if (f !== null) return (minutes.get(p._id) ?? 0) > f;
    const l = limitOf(p);
    return l !== null && (thisWeek.get(p._id) ?? 0) > l;
  }).length;
  const totalTaken = showMoney ? projects.reduce((n, p) => n + (takenCents(p) ?? 0), 0) : 0;
  const rated = projects.filter((p) => p.reviewRating != null);
  const avgReview = rated.length ? rated.reduce((n, p) => n + p.reviewRating!, 0) / rated.length : null;
  const th = "px-4 py-2.5 font-medium";

  return (
    <div className="space-y-5">
      {!showMoney && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segments items={[{ to: h(tab.id, status.id, teamOnly, { on: per.on }), text: "Week", on: !byMonth }, { to: h(tab.id, status.id, teamOnly, { by: "month", on: per.on }), text: "Month", on: byMonth }]} />
            <Link href={h(tab.id, status.id, teamOnly, { by: per.by, on: prevOn })} aria-label={`Previous ${unit}`} className="rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted">←</Link>
            <span className="min-w-44 text-center text-sm font-medium">{periodName}{isCurrent && <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-xs text-primary-tint-text">now</span>}</span>
            <Link href={h(tab.id, status.id, teamOnly, { by: per.by, on: nextOn })} aria-label={`Next ${unit}`} className="rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted">→</Link>
            {!isCurrent && <Link href={h(tab.id, status.id, teamOnly, { by: per.by })} className="text-sm text-primary hover:underline">Back to this {unit}</Link>}
          </div>
          <form action="/service" method="get" className="flex items-center gap-2 text-sm">
            {tab.id !== "timer" && <input type="hidden" name="tab" value={tab.id} />}
            {status.id !== "active" && <input type="hidden" name="status" value={status.id} />}
            {teamOnly && <input type="hidden" name="hours" value="team" />}
            {byMonth && <input type="hidden" name="by" value="month" />}
            <label className="text-zinc-500" htmlFor="jump-date">Jump to a date</label>
            <input id="jump-date" type="date" name="on" defaultValue={anchor} max={today} className="rounded-md border border-border-subtle bg-surface px-2 py-1.5" />
            <button className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-muted">Go</button>
          </form>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border-subtle">
        <Tabs items={STATUS_TABS.map((s) => ({ id: s.id, to: h(tab.id, s.id, teamOnly), text: s.label, on: s.id === status.id, count: counts(s) }))} />
        <div className="flex items-center gap-3 pb-2">
          <Segments items={TABS.map((t) => ({ to: h(t.id, status.id, teamOnly), text: t.label, on: t.id === tab.id }))} />
          <Link
            href={h(tab.id, status.id, !teamOnly)}
            aria-pressed={teamOnly}
            title="Count only your Digital Marketing team's hours"
            className={`rounded-md border px-3 py-1.5 text-sm ${teamOnly ? "border-primary bg-primary-tint font-medium text-primary-tint-text" : "border-border-subtle bg-surface text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`}
          >
            {teamOnly ? "✓ " : ""}My team only
          </Link>
        </div>
      </div>

      {showMoney ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi accent="info" label="Closed projects" value={projects.length.toLocaleString("en-IN")} />
          <Kpi accent="warn" label="Average closing review" value={avgReview !== null ? <><span className="text-status-warning-icon">★</span> {avgReview.toFixed(1)}</> : "—"} note={`${rated.length} of ${projects.length} have a review`} />
          <Kpi accent="pass" label="Taken from clients" value={fmtUsd(totalTaken)} note="Hourly: hours × rate. Fixed: the price. No rate or price counts as nothing." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi accent="pass" label="Active projects" value={activeOfType.length.toLocaleString("en-IN")} note={`${counts(STATUS_TABS[2])} on hold`} />
          <Kpi
            accent="primary"
            label={`Hours ${isCurrent ? `this ${unit} ` : ""}· ${periodName}`}
            value={fmtMinutes(weekMinutes)}
            note={quotaMinutes ? `of ${h1(quotaMinutes)}h ${unit === "week" ? "weekly" : "monthly"} quota · ${Math.round((weekMinutes / quotaMinutes) * 100)}%` : "No weekly quota set"}
          />
          <Kpi
            accent="info"
            label={`Revenue ${isCurrent ? `this ${unit}` : `· ${periodName}`}`}
            value={fmtUsd(revenueWeek)}
            note={`${scopeWeek ? `of ${fmtUsd(scopeWeek)} ${unit === "week" ? "weekly" : "monthly"} scope · ${Math.round((revenueWeek / scopeWeek) * 100)}%` : "No weekly scope set"}${fixedWeekCents ? ` · fixed: ${fmtUsd(fixedWeekCents)}` : ""}`}
          />
          <Kpi accent={overQuota ? "fail" : "pass"} label="Over limit" value={overQuota.toLocaleString("en-IN")} note={overQuota ? `past the ${unit === "week" ? "weekly" : "monthly"} quota (hourly) or the workable hours (fixed)` : "none"} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className={th}>Project</th>
              <th className={th}>BA / BD</th>
              <th className={th}>Type</th>
              <th className={`${th} text-right`}>Hours</th>
              {!showMoney && <th className={`${th} text-right`}>Revenue</th>}
              {showMoney && <th className={`${th} text-right`}>Review</th>}
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
                        <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-tint-text">Fixed</span>
                        <div className="mt-0.5 text-xs text-zinc-500">{billedByHours(p) ? `billed ${fmtUsd(c.hourlyRateCents!)}/h` : c.fixedPriceCents != null ? fmtUsd(c.fixedPriceCents) : "no price"}</div>
                      </>
                    ) : kind === "hourly" ? (
                      <>
                        <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-xs font-medium text-status-info-text">Hourly</span>
                        <div className="mt-0.5 text-xs tabular-nums text-zinc-500">{c.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "no rate"}</div>
                      </>
                    ) : (
                      <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-text" title="No rate or weekly quota entered: open the project to set Fixed or Hourly">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {billedByHours(p) ? (
                      <div className="tabular-nums">{fmtMinutes(minutes.get(p._id) ?? 0)} <span className="text-xs text-zinc-500">total, billed by hours</span></div>
                    ) : fixedBudget(p) !== null ? (
                      <WeekCell minutes={minutes.get(p._id) ?? 0} limit={fixedBudget(p)} unit="total" />
                    ) : (
                      <WeekCell minutes={thisWeek.get(p._id) ?? 0} limit={limitOf(p)} />
                    )}
                    {kind === "fixed" && <div className="mt-1 text-xs tabular-nums text-zinc-500">{fmtMinutes(thisWeek.get(p._id) ?? 0)} {isCurrent ? `this ${unit}` : `in this ${unit}`}</div>}
                  </td>
                  {!showMoney && <td className="px-4 py-2.5 text-right"><MoneyCell cents={achievedCents(p)} scope={scopeCents(p)} /></td>}
                  {showMoney && (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.reviewRating != null ? <span title={`${p.reviewRating.toFixed(1)} out of 5`}><span className="text-status-warning-icon">★</span> {p.reviewRating.toFixed(1)}</span> : "—"}
                    </td>
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
