import Link from "next/link";
import { CloseFromPosts } from "./_components/CloseFromPosts";
import type { ReactNode } from "react";
import { connectToDatabase } from "@/lib/db/connect";
import { entriesFor, senderNames } from "@/lib/service/api/hours";
import { canonicalBa } from "@/lib/service/ba-members";
import { canonicalBd } from "@/lib/service/bd-members";
import { dmHasLeft, dmMatch } from "@/lib/service/dm-members";
import { loadAllTimeEntries } from "@/lib/service/hours/all-time";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { STANDARD_RATE_CENTS, workableMinutes } from "@/lib/service/hours/fixed-budget";
import { limitForPeriod, type LimitStep } from "@/lib/service/hours/limit-history";
import { istDate } from "@/lib/service/import/text";
import { weekOf } from "@/lib/service/import/week";
import { fmtLongDay, fmtMinutes, fmtUsd, shiftWeek, weekLabel } from "@/lib/service/ui/format";
import type { ServiceProjectStatus } from "@/models/service-shared";
import { ServiceProject } from "@/models/service-project";
import { ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceUser } from "@/models/service-user";
import { projectHref } from "@/lib/service/ui/back";
import { statusOnDay, type StatusStep } from "@/lib/service/projects/status-at";

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
  assignments?: Array<{ userId: string; role: "MANAGER" | "EMPLOYEE" }>;
  /** Set by the overview, not stored: see "Moved to another department". */
  movedDept?: boolean;
  /** Status changes with their dates: a past week or month shows the status the project had then. */
  history?: StatusStep[];
  /** Manual placement (project Settings): STAY = never moved, MOVED = always moved, null = the automatic 30-day rule. */
  deptOverride?: "STAY" | "MOVED" | null;
  contract: {
    type: "HOURLY" | "FIXED";
    hourlyRateCents: number | null;
    weeklyLimitMinutes: number | null;
    fixedPriceCents: number | null;
    weeklyLimitHistory?: LimitStep[];
  } | null;
};

// Every contract made in the old app defaulted to HOURLY, so an hourly contract with no rate and no weekly quote has a type nobody
// chose (owner, 2026-11-16): it shows "Not set", only under All.
type Kind = "hourly" | "fixed" | "unset";
const kindOf = (p: Row): Kind =>
  p.contract?.type === "FIXED" ? "fixed" : p.contract && (p.contract.hourlyRateCents != null || p.contract.weeklyLimitMinutes != null) ? "hourly" : "unset";

// Type switch (owner, 2026-11-18: open on All so the status counts cover every project; before, Timer was the default and the
// counts looked like the whole company's).
const TABS = [
  { id: "all", label: "All", match: () => true },
  { id: "timer", label: "Timer", match: (p: Row) => kindOf(p) === "hourly" },
  { id: "fixed", label: "Fixed", match: (p: Row) => kindOf(p) === "fixed" },
] as const;
const DEFAULT_TAB = "all";

const STATUS_TABS = [
  { id: "active", label: "Active", match: (p: Row) => ["NOT_STARTED", "ACTIVE", "BLOCKED", "PARTIAL_HOLD"].includes(p.status) },
  // Waiting for client counts as on hold, with its own tag and its own filter (owner, 2026-11-20).
  { id: "on_hold", label: "On hold", match: (p: Row) => p.status === "ON_HOLD" || p.status === "WAITING_FOR_CLIENT" },
  { id: "closed", label: "Closed", match: (p: Row) => ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(p.status) },
  { id: "all", label: "All", match: () => true },
] as const;

/** The period being looked at: a Monday-to-Sunday week or a calendar month (owner, 2026-11-17: look back at any past week or month). */
type Per = { by?: "month"; on?: string; hold?: string };
const href = (tab: string, status: string, teamOnly: boolean, per: Per = {}) => {
  const q = new URLSearchParams();
  if (tab !== DEFAULT_TAB) q.set("tab", tab);
  if (status !== "active") q.set("status", status);
  if (teamOnly) q.set("hours", "team");
  if (per.by) q.set("by", per.by);
  if (per.on) q.set("on", per.on);
  if (per.hold && status === "on_hold") q.set("hold", per.hold);
  return q.size ? `/service?${q}` : "/service";
};
const isoDay = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null);
const monthBounds = (anchor: string) => {
  const [y, m] = anchor.split("-").map(Number);
  return { start: `${anchor.slice(0, 7)}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
};
const shiftMonth = (anchor: string, by: number) => {
  const [y, m] = anchor.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10);
};

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

const DOT: Record<string, string> = {
  active: "bg-status-pass-icon",
  closed: "bg-status-info-icon",
  on_hold: "bg-status-warning-icon",
  all: "bg-status-not-tested-icon",
};

/** Status filter: one rounded group, the chosen status a raised pill with its colour dot and count (owner, 2026-11-18: make it look better; On hold second). */
function Tabs({ items }: { items: Array<{ id: string; to: string; text: string; on: boolean; count: number }> }) {
  return (
    <nav aria-label="Project status" className="inline-flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-surface-muted p-1">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.to}
          aria-current={i.on ? "page" : undefined}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-colors ${i.on ? "bg-surface font-semibold text-zinc-900 shadow-sm ring-1 ring-border-subtle dark:text-zinc-100" : "text-zinc-500 hover:bg-surface/60 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
        >
          <span className={`h-2 w-2 rounded-full ${DOT[i.id]}`} aria-hidden="true" />
          {i.text}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${i.on ? "bg-primary-tint text-primary-tint-text" : "bg-surface text-zinc-500"}`}
          >
            {i.count}
          </span>
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
        <span className="text-zinc-500">
          of {h1(limit)}h{unit === "total" ? " total" : ""}
        </span>
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

export default async function ServiceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; hours?: string; by?: string; on?: string; hold?: string }>;
}) {
  const sp = await searchParams;
  const teamOnly = sp.hours === "team";
  // The list as it is now (owner, 2026-11-23): a project's Back link returns here, same period and filters.
  const here = (() => {
    const q = new URLSearchParams();
    for (const k of ["tab", "status", "hours", "by", "on", "hold"] as const) if (sp[k]) q.set(k, sp[k]!);
    return q.size ? `/service?${q}` : "/service";
  })();
  const tab = TABS.find((t) => t.id === sp.tab) ?? TABS.find((t) => t.id === DEFAULT_TAB)!;
  const status = STATUS_TABS.find((s) => s.id === sp.status) ?? STATUS_TABS[0];
  await connectToDatabase();
  const [allRows, profiles, att, names, users] = await Promise.all([
    ServiceProject.find()
      .select("name clientId status reviewRating contract upworkProfileId people assignments deptOverride history")
      .sort({ name: 1 })
      .lean<Row[]>(),
    ServiceUpworkProfile.find().select("name").lean<Array<{ _id: string; name: string }>>(),
    loadAttribution(),
    senderNames(),
    ServiceUser.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
  ]);
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  const profileName = new Map(profiles.map((x) => [x._id, x.name]));
  const who = (p: Row, role: string) =>
    [
      ...new Set(
        p.people
          .filter((x) => x.role === role)
          .map((x) => (role === "BUSINESS_DEVELOPER" ? canonicalBd(x.name) : role === "BUSINESS_ANALYST" ? canonicalBa(x.name) : x.name))
      ),
    ].join(", ");
  const today = istDate(new Date());
  const countsFor = (sender: string) => !teamOnly || dmMatch(names.get(sender)) !== null;
  // Closed projects: what we took from the client, from all reported hours.
  const showMoney = status.id === "closed";
  const minutes = new Map<string, number>();
  // Digital Marketing members involved in a project (owner, 2026-11-20): everyone on the team who ever reported hours on it (most hours
  // first), then team members listed on the project's people without any report. Always from all-time hours, whatever the period.
  const dmHours = new Map<string, Map<string, number>>();
  const lastAnyDay = new Map<string, string>();
  const lastDmDay = new Map<string, string>();
  const lastDmReport = new Map<string, string>();
  const twoMonthsAgo = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 2);
    return d.toISOString().slice(0, 10);
  })();
  const dmActive = (name: string) => !dmHasLeft(name) && (lastDmReport.get(dmMatch(name) ?? "") ?? "") >= twoMonthsAgo;
  // All-time hours are needed for Closed (money), for fixed-price projects (hours used against the workable total) and for the team column.
  {
    const entries = await loadAllTimeEntries();
    // A team member with no report anywhere in the last 2 months is left out of the DM team column (owner, 2026-11-20). Dates after
    // today are typing errors and do not count as a report.
    for (const e of entries) {
      const key = dmMatch(names.get(e.senderExternalId));
      const d = e.entryDate.toISOString().slice(0, 10);
      if (key && d <= today && d > (lastDmReport.get(key) ?? "")) lastDmReport.set(key, d);
    }
    for (const e of expandAllocations(entries)) {
      const pid = projectOf(e, att.owner);
      if (!pid) continue;
      const who_ = names.get(e.senderExternalId);
      const day_ = e.entryDate.toISOString().slice(0, 10);
      if (day_ <= today) {
        if (day_ > (lastAnyDay.get(pid) ?? "")) lastAnyDay.set(pid, day_);
        if (dmMatch(who_) !== null && day_ > (lastDmDay.get(pid) ?? "")) lastDmDay.set(pid, day_);
      }
      if (dmMatch(who_) !== null && who_) {
        const m = dmHours.get(pid) ?? new Map<string, number>();
        m.set(who_, (m.get(who_) ?? 0) + e.minutes);
        dmHours.set(pid, m);
      }
      if (countsFor(e.senderExternalId)) minutes.set(pid, (minutes.get(pid) ?? 0) + e.minutes);
    }
  }
  // Moved to another department (owner, 2026-11-20): a project other teams still report on but nobody from the team has reported on for
  // 30 days (the gestation period) leaves Active / On hold for the On hold tab's "Moved to another department" group. Only the overview
  // moves it: the project's own status is unchanged. Dates after today are typing errors and were ignored above.
  // Hours reported in the chosen period per project (the same placement as the project page); the period is the current week unless
  // ?by=month or ?on=YYYY-MM-DD (any day inside the week / month wanted) is given.
  const anchor = isoDay(sp.on) ?? today;
  const byMonth = sp.by === "month";
  const week = byMonth ? monthBounds(anchor) : weekOf(anchor);
  const isCurrent = today >= week.start && today <= week.end;
  const MOVED_DAYS = 30;
  const movedCutoff = new Date(new Date(`${today}T00:00:00Z`).getTime() - MOVED_DAYS * 86_400_000).toISOString().slice(0, 10);
  // A past week or month shows each project with the status it had at the end of that period (owner, 2026-11-23: a project completed on
  // 15 August looks Active in the week before). The department placement is today's and is not applied to a past period.
  const pastEnd = week.end < today ? week.end : null;
  const all: Row[] = allRows.map((p) => {
    if (pastEnd) return { ...p, status: statusOnDay(p.status, p.history, pastEnd, (d) => istDate(d)) as ServiceProjectStatus };
    if (p.status !== "ACTIVE" && p.status !== "ON_HOLD") return p;
    // The manual placement in the project's Settings beats the automatic rule (owner, 2026-11-21).
    if (p.deptOverride === "STAY") return p;
    const automatic = (lastAnyDay.get(p._id) ?? "") >= movedCutoff && (lastDmDay.get(p._id) ?? "") < movedCutoff;
    return p.deptOverride === "MOVED" || automatic ? { ...p, status: "ON_HOLD" as const, movedDept: true } : p;
  });
  const ofType = all.filter(tab.match);
  const inStatus = ofType.filter(status.match);
  const counts = (s: (typeof STATUS_TABS)[number]) => ofType.filter(s.match).length;

  // On hold is split into groups (owner, 2026-11-20); `hold` picks one: idle (nobody reported in 30 days), moved (to another department),
  // waiting (for the client), team (the team reported in the last 30 days but the project is on hold).
  const HOLD_KINDS = ["idle", "moved", "team", "waiting"] as const;
  const holdFilter = status.id === "on_hold" ? HOLD_KINDS.find((k) => k === sp.hold) : undefined;
  const per: Per = { by: byMonth ? "month" : undefined, on: isoDay(sp.on) ?? undefined, hold: holdFilter };
  const periodName = byMonth
    ? new Date(`${week.start}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : weekLabel(week);
  const unit = byMonth ? "month" : "week";
  const prevOn = byMonth ? shiftMonth(anchor, -1) : shiftWeek(week.start, -1);
  const nextOn = byMonth ? shiftMonth(anchor, 1) : shiftWeek(week.start, 1);
  const h = (t: string, st: string, tm: boolean, p: Per = per) => href(t, st, tm, p);
  const thisWeek = new Map<string, number>();
  for (const e of await entriesFor("ANY", week)) {
    const pid = projectOf(e, att.owner);
    if (pid && countsFor(e.senderExternalId)) thisWeek.set(pid, (thisWeek.get(pid) ?? 0) + e.minutes);
  }
  const limitOf = (p: Row) => (p.contract ? limitForPeriod(p.contract.weeklyLimitHistory ?? [], p.contract.weeklyLimitMinutes, week.start, week.end) : null);

  /** Why a project is on hold: nobody reported in the window, only others did, or the team did (held by hand / waiting for the next sync). */
  const holdKindOf = (p: Row): (typeof HOLD_KINDS)[number] =>
    p.status === "WAITING_FOR_CLIENT" ? "waiting" : p.movedDept ? "moved" : (lastAnyDay.get(p._id) ?? "") < movedCutoff ? "idle" : "team";
  const onHoldAll = status.id === "on_hold" ? inStatus : [];
  const holdCount = (k: (typeof HOLD_KINDS)[number]) => onHoldAll.filter((p) => holdKindOf(p) === k).length;
  const projects = holdFilter ? inStatus.filter((p) => holdKindOf(p) === holdFilter) : inStatus;
  const dmTeamOf = (p: Row): string[] => {
    const byHours = [...(dmHours.get(p._id) ?? [])]
      .filter(([n, m]) => m > 0 && dmActive(n))
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    const seen = new Set(byHours.map((n) => dmMatch(n)));
    const listed = p.people.filter((x) => dmMatch(x.name) !== null && dmActive(x.name) && !seen.has(dmMatch(x.name))).map((x) => x.name);
    for (const n of listed) seen.add(dmMatch(n));
    // People assigned in Settings: team members assigned as employees or managers join as themselves. A manager who is not a team member
    // (Huzefa, the owner: every DM project is his) is not listed (owner, 2026-11-20).
    const assigned = (p.assignments ?? []).map((a) => ({ name: userName.get(a.userId) ?? "", role: a.role })).filter((a) => a.name);
    const assignedDm = assigned.filter((a) => dmMatch(a.name) !== null && dmActive(a.name) && !seen.has(dmMatch(a.name))).map((a) => a.name);
    for (const n of assignedDm) seen.add(dmMatch(n));
    return [...byHours, ...listed, ...assignedDm];
  };
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
  const quotaMinutes = projects.reduce((n, p) => n + (fixedBudget(p) === null ? (limitOf(p) ?? 0) : 0), 0);
  // Amounts (owner, 2026-11-17: "revenue generated, total scope of work in amount and how much achieved, like the hours"):
  // hourly = this week's hours x the hourly rate against the weekly quota x the rate; fixed = hours used x $15 against the fixed price.
  const rateOf = (p: Row) => (kindOf(p) === "fixed" && !billedByHours(p) ? STANDARD_RATE_CENTS : (p.contract?.hourlyRateCents ?? null));
  const scopeCents = (p: Row): number | null => {
    if (kindOf(p) === "fixed") return billedByHours(p) ? null : (p.contract?.fixedPriceCents ?? null);
    const l = limitOf(p);
    const r = rateOf(p);
    return l !== null && r !== null ? Math.round((l / 60) * r) : null;
  };
  const achievedCents = (p: Row): number => {
    const r = rateOf(p);
    if (r === null) return 0;
    const m = kindOf(p) === "fixed" ? (minutes.get(p._id) ?? 0) : (thisWeek.get(p._id) ?? 0);
    return Math.round((m / 60) * r);
  };
  const hourlyInView = projects.filter((p) => kindOf(p) === "hourly");
  const revenueWeek = hourlyInView.reduce((n, p) => n + achievedCents(p), 0);
  const scopeWeek = hourlyInView.reduce((n, p) => n + (scopeCents(p) ?? 0), 0);
  const fixedWeekCents = projects
    .filter((p) => kindOf(p) === "fixed")
    .reduce((n, p) => n + Math.round(((thisWeek.get(p._id) ?? 0) / 60) * (rateOf(p) ?? 0)), 0);
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
  // Highest money first in every view (owner, 2026-11-20), by the money taken in the SELECTED period: the period's hours x the project's
  // rate (hourly rate; fixed projects at their billed rate or the standard $15/h). Closed has no period (all-time view), so it is
  // ordered by Taken from client. Projects with no figure last, ties by name.
  const periodCents = (p: Row) => {
    const r = rateOf(p);
    return r === null ? 0 : Math.round(((thisWeek.get(p._id) ?? 0) / 60) * r);
  };
  const moneyOf = (p: Row) => (showMoney ? takenCents(p) : periodCents(p)) ?? -1;
  const ranked = [...projects].sort((x, y) => moneyOf(y) - moneyOf(x) || x.name.localeCompare(y.name));

  return (
    <div className="space-y-5">
      {!showMoney && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segments
              items={[
                { to: h(tab.id, status.id, teamOnly, { on: per.on }), text: "Week", on: !byMonth },
                { to: h(tab.id, status.id, teamOnly, { by: "month", on: per.on }), text: "Month", on: byMonth },
              ]}
            />
            <Link
              href={h(tab.id, status.id, teamOnly, { by: per.by, on: prevOn })}
              aria-label={`Previous ${unit}`}
              className="rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted"
            >
              ←
            </Link>
            <span className="min-w-44 text-center text-sm font-medium">
              {periodName}
              {isCurrent && <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-xs text-primary-tint-text">now</span>}
            </span>
            <Link
              href={h(tab.id, status.id, teamOnly, { by: per.by, on: nextOn })}
              aria-label={`Next ${unit}`}
              className="rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted"
            >
              →
            </Link>
            {!isCurrent && (
              <Link href={h(tab.id, status.id, teamOnly, { by: per.by })} className="text-sm text-primary hover:underline">
                Back to this {unit}
              </Link>
            )}
          </div>
          <form action="/service" method="get" className="flex items-center gap-2 text-sm">
            {tab.id !== DEFAULT_TAB && <input type="hidden" name="tab" value={tab.id} />}
            {status.id !== "active" && <input type="hidden" name="status" value={status.id} />}
            {teamOnly && <input type="hidden" name="hours" value="team" />}
            {byMonth && <input type="hidden" name="by" value="month" />}
            {holdFilter && <input type="hidden" name="hold" value={holdFilter} />}
            <label className="text-zinc-500" htmlFor="jump-date">
              Jump to a date
            </label>
            <input
              id="jump-date"
              type="date"
              name="on"
              defaultValue={anchor}
              max={today}
              className="rounded-md border border-border-subtle bg-surface px-2 py-1.5"
            />
            <button className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-muted">Go</button>
          </form>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Tabs items={STATUS_TABS.map((s) => ({ id: s.id, to: h(tab.id, s.id, teamOnly), text: s.label, on: s.id === status.id, count: counts(s) }))} />
        <div className="flex items-center gap-3">
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

      {status.id === "on_hold" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Segments
            items={[
              { to: h(tab.id, "on_hold", teamOnly, { ...per, hold: undefined }), text: `All on hold ${onHoldAll.length}`, on: !holdFilter },
              { to: h(tab.id, "on_hold", teamOnly, { ...per, hold: "idle" }), text: `No activity ${holdCount("idle")}`, on: holdFilter === "idle" },
              {
                to: h(tab.id, "on_hold", teamOnly, { ...per, hold: "moved" }),
                text: `Moved to another department ${holdCount("moved")}`,
                on: holdFilter === "moved",
              },
              ...(holdCount("waiting") > 0
                ? [
                    {
                      to: h(tab.id, "on_hold", teamOnly, { ...per, hold: "waiting" }),
                      text: `Waiting for client ${holdCount("waiting")}`,
                      on: holdFilter === "waiting",
                    },
                  ]
                : []),
              ...(holdCount("team") > 0
                ? [{ to: h(tab.id, "on_hold", teamOnly, { ...per, hold: "team" }), text: `Team reported ${holdCount("team")}`, on: holdFilter === "team" }]
                : []),
            ]}
          />
          <span className="text-xs text-zinc-500">
            30-day window. Moved to another department = other teams still report, none from your team for 30 days; No activity = nobody reported.
          </span>
        </div>
      )}
      {status.id === "on_hold" && <CloseFromPosts />}

      {showMoney ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi accent="info" label="Closed projects" value={projects.length.toLocaleString("en-IN")} />
          <Kpi
            accent="warn"
            label="Average closing review"
            value={
              avgReview !== null ? (
                <>
                  <span className="text-status-warning-icon">★</span> {avgReview.toFixed(1)}
                </>
              ) : (
                "—"
              )
            }
            note={`${rated.length} of ${projects.length} have a review`}
          />
          <Kpi
            accent="pass"
            label="Taken from clients"
            value={fmtUsd(totalTaken)}
            note="Hourly: hours × rate. Fixed: the price. No rate or price counts as nothing."
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            accent="pass"
            label="Active projects"
            value={activeOfType.length.toLocaleString("en-IN")}
            note={`${counts(STATUS_TABS.find((x) => x.id === "on_hold")!)} on hold`}
          />
          <Kpi
            accent="primary"
            label={`Hours ${isCurrent ? `this ${unit} ` : ""}· ${periodName}`}
            value={fmtMinutes(weekMinutes)}
            note={
              quotaMinutes
                ? `of ${h1(quotaMinutes)}h ${unit === "week" ? "weekly" : "monthly"} quota · ${Math.round((weekMinutes / quotaMinutes) * 100)}%`
                : "No weekly quota set"
            }
          />
          <Kpi
            accent="info"
            label={`Revenue ${isCurrent ? `this ${unit}` : `· ${periodName}`}`}
            value={fmtUsd(revenueWeek)}
            note={`${scopeWeek ? `of ${fmtUsd(scopeWeek)} ${unit === "week" ? "weekly" : "monthly"} scope · ${Math.round((revenueWeek / scopeWeek) * 100)}%` : "No weekly scope set"}${fixedWeekCents ? ` · fixed: ${fmtUsd(fixedWeekCents)}` : ""}`}
          />
          <Kpi
            accent={overQuota ? "fail" : "pass"}
            label="Over limit"
            value={overQuota.toLocaleString("en-IN")}
            note={overQuota ? `past the ${unit === "week" ? "weekly" : "monthly"} quota (hourly) or the workable hours (fixed)` : "none"}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className={th}>Project</th>
              <th className={th}>BA / BD</th>
              <th className={th}>DM team</th>
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
                <td colSpan={showMoney ? 7 : 6} className="px-4 py-8 text-center text-zinc-500">
                  No projects match these filters.
                </td>
              </tr>
            )}
            {ranked.map((p) => {
              const c = p.contract;
              const kind = kindOf(p);
              const ba = who(p, "BUSINESS_ANALYST");
              const bd = who(p, "BUSINESS_DEVELOPER");
              return (
                <tr key={p._id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={projectHref(p._id, here)} className="font-medium text-zinc-900 hover:text-primary hover:underline dark:text-zinc-100">
                      {p.name}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {(p.upworkProfileId && profileName.get(p.upworkProfileId)) || "No profile"}
                      {p.movedDept && (
                        <span
                          className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-medium text-primary-tint-text"
                          title="Other teams report on it, none from your team for 30 days. Its own status is unchanged."
                        >
                          ⇄ Another department
                        </span>
                      )}
                      {p.status === "WAITING_FOR_CLIENT" && (
                        <span
                          className="ml-2 rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-medium text-status-info-text"
                          title="Waiting for the client to reply"
                        >
                          ◔ Waiting for client
                        </span>
                      )}
                      {p.status === "PARTIAL_HOLD" && (
                        <span
                          className="ml-2 rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-medium text-status-warning-text"
                          title="Client on a break: still a live project, never put on hold automatically"
                        >
                          ◑ Partial hold
                        </span>
                      )}
                    </div>
                    {(p.status === "ON_HOLD" || p.status === "WAITING_FOR_CLIENT") && (
                      <div className="text-xs text-zinc-400">
                        {lastAnyDay.get(p._id) ? `Last report ${fmtLongDay(lastAnyDay.get(p._id)!)}` : "No report yet"}
                        {lastDmDay.get(p._id) && lastDmDay.get(p._id) !== lastAnyDay.get(p._id)
                          ? ` · team ${fmtLongDay(lastDmDay.get(p._id)!)}`
                          : lastAnyDay.get(p._id) && !lastDmDay.get(p._id)
                            ? " · none from the team"
                            : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                    <div>{ba || "—"}</div>
                    <div className="text-xs text-zinc-500">{bd || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {(() => {
                      const team = dmTeamOf(p);
                      if (team.length === 0) return <span className="text-zinc-400">—</span>;
                      const first = (n: string) => n.split(" ")[0];
                      return (
                        <div title={team.join(", ")} className="max-w-48 text-xs leading-5">
                          {team.slice(0, 4).map(first).join(", ")}
                          {team.length > 4 && <span className="text-zinc-400"> +{team.length - 4}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5">
                    {!c ? (
                      <span className="text-zinc-400">No contract</span>
                    ) : kind === "fixed" ? (
                      <>
                        <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-tint-text">Fixed</span>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {billedByHours(p) ? `billed ${fmtUsd(c.hourlyRateCents!)}/h` : c.fixedPriceCents != null ? fmtUsd(c.fixedPriceCents) : "no price"}
                        </div>
                      </>
                    ) : kind === "hourly" ? (
                      <>
                        <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-xs font-medium text-status-info-text">Hourly</span>
                        <div className="mt-0.5 text-xs tabular-nums text-zinc-500">
                          {c.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "no rate"}
                        </div>
                      </>
                    ) : (
                      <span
                        className="rounded-full bg-status-warning-bg px-2 py-0.5 text-xs font-medium text-status-warning-text"
                        title="No rate or weekly quota entered: open the project to set Fixed or Hourly"
                      >
                        Not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {/* Fixed projects (owner 2026-11-19): the period's work first, the total (or billed total) under it. */}
                    {kind === "fixed" && !showMoney && (
                      <div className="mb-1 tabular-nums">
                        {fmtMinutes(thisWeek.get(p._id) ?? 0)} <span className="text-xs text-zinc-500">{isCurrent ? `this ${unit}` : `in this ${unit}`}</span>
                      </div>
                    )}
                    {showMoney ? (
                      // Closed (owner, 2026-11-18): the total hours worked on the project over its life, not this week's.
                      <div className="tabular-nums">
                        {(minutes.get(p._id) ?? 0) > 0 ? fmtMinutes(minutes.get(p._id)!) : "—"} <span className="text-xs text-zinc-500">total</span>
                      </div>
                    ) : billedByHours(p) ? (
                      <div className="tabular-nums">
                        {fmtMinutes(minutes.get(p._id) ?? 0)} <span className="text-xs text-zinc-500">total, billed by hours</span>
                      </div>
                    ) : fixedBudget(p) !== null ? (
                      <WeekCell minutes={minutes.get(p._id) ?? 0} limit={fixedBudget(p)} unit="total" />
                    ) : (
                      <WeekCell minutes={thisWeek.get(p._id) ?? 0} limit={limitOf(p)} />
                    )}
                  </td>
                  {!showMoney && (
                    <td className="px-4 py-2.5 text-right">
                      {/* Fixed projects (owner 2026-11-20): what the period's hours were worth on top, the all-time amount under it. */}
                      {kind === "fixed" && (
                        <div className="mb-1 tabular-nums">
                          {fmtUsd(periodCents(p))} <span className="text-xs text-zinc-500">{isCurrent ? `this ${unit}` : `in this ${unit}`}</span>
                        </div>
                      )}
                      {billedByHours(p) ? (
                        <div className="tabular-nums">
                          {fmtUsd(achievedCents(p))} <span className="text-xs text-zinc-500">total</span>
                        </div>
                      ) : (
                        <MoneyCell cents={achievedCents(p)} scope={scopeCents(p)} />
                      )}
                    </td>
                  )}
                  {showMoney && (
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.reviewRating != null ? (
                        <span title={`${p.reviewRating.toFixed(1)} out of 5`}>
                          <span className="text-status-warning-icon">★</span> {p.reviewRating.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {showMoney && <td className="px-4 py-2.5 text-right tabular-nums">{takenCents(p) != null ? fmtUsd(takenCents(p)!) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Reported hours from the TIMER STATUS space, not Upwork-verified.{" "}
        {teamOnly ? "Only your Digital Marketing team's reports are counted." : "Everyone on a project counts."}
      </p>
    </div>
  );
}
