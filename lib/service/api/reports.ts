import "server-only";
// Dashboard tabs (ported from the Upwork app's reports.controller.ts and entry-rows.ts): each has its own overview and table
// for any date range. Reported and tracked hours only. One shared login: everyone sees everything, amounts included.
import { badRequest } from "./http";
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { loadProjectDepartments } from "../reports/project-departments";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceUser } from "@/models/service-user";

export const DAY_MS = 86_400_000;
export const MAX_RANGE_DAYS = 366;

export const dayOf = (d: Date) => d.toISOString().slice(0, 10);
export const shiftDays = (iso: string, days: number) => dayOf(new Date(Date.parse(iso) + days * DAY_MS));
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;

export type Range = { from: string; to: string; days: number };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A date range from query parameters: both ends required, from <= to, at most a year. */
export function parseRange(from?: string | null, to?: string | null): Range {
  if (!from || !to || !ISO.test(from) || !ISO.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw badRequest("from and to must be YYYY-MM-DD");
  if (from > to) throw badRequest("from must not be after to");
  const days = daysBetween(from, to);
  if (days > MAX_RANGE_DAYS) throw badRequest(`the range can be at most ${MAX_RANGE_DAYS} days`);
  return { from, to, days };
}

/** The range of the same length immediately before this one. */
export const previousRange = (r: Range): Range => ({ from: shiftDays(r.from, -r.days), to: shiftDays(r.from, -1), days: r.days });

export type Row = {
  id: string;
  senderKey: string;
  entryDate: string;
  minutes: number;
  source: "TIMER_CALCULATED" | "MANUAL_REPORT";
  flagged: boolean;
  late: boolean;
  projectId: string | null;
  /** The department of the entry's project; null when the entry is on no project. */
  departmentId: string | null;
  project: string;
  client: string | null;
  inHouse: boolean;
  memo: string | null;
  postedAt: Date;
};

type Context = Awaited<ReturnType<typeof loadContext>>;

/** Attribution, departments and names: loaded once per request and shared by every loadEntryRows call. */
export async function loadContext() {
  const [att, deps] = await Promise.all([loadAttribution(), loadProjectDepartments()]);
  return {
    owner: att.owner,
    shared: att.shared,
    liveProjects: att.projects,
    deptOf: deps.deptOf,
    departments: deps.departments,
    names: new Map(deps.projects.map((p) => [p._id, p.name])),
    inHouseProjects: new Set(deps.projects.filter((p) => p.inHouse).map((p) => p._id)),
  };
}

type RawEntry = {
  _id: string;
  senderExternalId: string;
  entryDate: Date;
  minutes: number;
  source: "TIMER_CALCULATED" | "MANUAL_REPORT";
  state: string;
  isLate: boolean;
  projectId: string | null;
  clientId: string | null;
  memo: string | null;
  allocations: Array<{ projectId: string; minutes: number }>;
  postedAt: Date;
};

/** Counted entries between two dates (IST days), optionally of one Chat sender. A shared entry becomes one row per share. */
export async function loadEntryRows(ctx: Context, from: string, to: string, senderExternalId?: string): Promise<Row[]> {
  const match: Record<string, unknown> = { state: { $ne: "REJECTED" }, entryDate: { $gte: new Date(`${from}T00:00:00Z`), $lte: new Date(`${to}T00:00:00Z`) } };
  if (senderExternalId) match.senderExternalId = senderExternalId;
  const entries = await ServiceTimeEntry.aggregate<RawEntry>([
    { $match: match },
    { $lookup: { from: "service_chat_messages", localField: "sourceMessageId", foreignField: "_id", as: "m", pipeline: [{ $project: { _id: 0, postedAt: 1 } }] } },
    { $project: { senderExternalId: 1, entryDate: 1, minutes: 1, source: 1, state: 1, isLate: 1, projectId: 1, clientId: 1, memo: 1, allocations: 1, postedAt: { $ifNull: [{ $first: "$m.postedAt" }, "$createdAt"] } } },
  ]);
  const clientIds = [...new Set(entries.map((e) => e.clientId).filter((x): x is string => !!x))];
  const clients = new Map((await ServiceClient.find({ _id: { $in: clientIds } }).select("name inHouse").lean<Array<{ _id: string; name: string; inHouse: boolean }>>()).map((c) => [c._id, c]));
  const out: Row[] = [];
  let n = 0;
  for (const e of expandAllocations(entries)) {
    const pid = projectOf(e, ctx.owner);
    const c = e.clientId ? clients.get(e.clientId) : undefined;
    out.push({
      id: e.allocations.length > 1 ? `${e._id}~${++n}` : e._id, senderKey: e.senderExternalId, entryDate: dayOf(e.entryDate), minutes: e.minutes, source: e.source,
      flagged: e.state === "NEEDS_REVIEW", late: e.isLate, projectId: pid, departmentId: pid ? ctx.deptOf.get(pid) ?? null : null,
      project: (pid && ctx.names.get(pid)) || c?.name || "No project",
      client: c?.name ?? null, inHouse: (c?.inHouse ?? false) || (pid !== null && ctx.inHouseProjects.has(pid)), memo: e.memo, postedAt: new Date(e.postedAt),
    });
  }
  return out;
}

/** Monday to Saturday days inside a range (a Sunday is never counted as a working day). */
export function workingDaysIn(from: string, to: string): number {
  let n = 0;
  for (let d = from; d <= to; d = shiftDays(d, 1)) if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) n++;
  return n;
}

/** Measurable figures for a set of rows. */
export function summarise(rows: Row[], previousMinutes: number, workingDays: number) {
  const minutes = rows.reduce((n, r) => n + r.minutes, 0);
  const days = new Set(rows.filter((r) => r.minutes > 0).map((r) => r.entryDate));
  const byProject = new Map<string, number>();
  for (const r of rows) byProject.set(r.project, (byProject.get(r.project) ?? 0) + r.minutes);
  const timer = rows.filter((r) => r.source === "TIMER_CALCULATED").reduce((n, r) => n + r.minutes, 0);
  return {
    minutes, timerMinutes: timer, manualMinutes: minutes - timer,
    activeDays: days.size, workingDays, avgPerActiveDay: days.size ? Math.round(minutes / days.size) : 0,
    previousWeekMinutes: previousMinutes, previousMinutes, entries: rows.length,
    flagged: rows.filter((r) => r.flagged).length, late: rows.filter((r) => r.late).length,
    clients: new Set(rows.map((r) => r.client).filter(Boolean)).size,
    projects: [...byProject].map(([name, m]) => ({ name, minutes: m })).filter((p) => p.minutes > 0).sort((a, b) => b.minutes - a.minutes),
    lastReportAt: rows.reduce<Date | null>((m, r) => (!m || r.postedAt > m ? r.postedAt : m), null),
  };
}

export type PersonUser = { id: string; displayName: string } | null;

async function sendersWithUsers() {
  const [senders, users] = await Promise.all([
    ServiceChatSender.find().sort({ displayName: 1 }).select("externalId displayName userId").lean<Array<{ _id: string; externalId: string; displayName: string; userId: string | null }>>(),
    ServiceUser.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
  ]);
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  return senders.map((s) => ({ ...s, user: s.userId && userName.has(s.userId) ? { id: s.userId, displayName: userName.get(s.userId)! } : null }));
}

/** Every person with hours (or hours in the period before) in a range, most hours first. */
export async function buildPeople(ctx: Context, range: Range) {
  const prev = previousRange(range);
  const [now, before, senders] = await Promise.all([loadEntryRows(ctx, range.from, range.to), loadEntryRows(ctx, prev.from, prev.to), sendersWithUsers()]);
  const working = workingDaysIn(range.from, range.to);
  const nowBy = new Map<string, Row[]>();
  for (const r of now) nowBy.set(r.senderKey, [...(nowBy.get(r.senderKey) ?? []), r]);
  const beforeBy = new Map<string, number>();
  for (const r of before) beforeBy.set(r.senderKey, (beforeBy.get(r.senderKey) ?? 0) + r.minutes);
  const people = senders
    .map((s) => {
      const mine = nowBy.get(s.externalId) ?? [];
      return { id: s._id, name: s.displayName, user: s.user, rows: mine, ...summarise(mine, beforeBy.get(s.externalId) ?? 0, working) };
    })
    .filter((p) => p.entries > 0 || p.previousMinutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  return { people, previousRange: prev, workingDays: working };
}

// --- Projects tab ---------------------------------------------------------------------------------------------------------

export const KINDS = ["direct", "fixed", "timer"] as const;
export type Kind = (typeof KINDS)[number];
const CLOSED = new Set(["COMPLETED", "CANCELLED", "ARCHIVED"]);
const ATTENTION = ["BLOCKED", "WAITING_FOR_CLIENT", "ON_HOLD"];
const ACTIVE_LOOKBACK_DAYS = 21; // active = counted hours in the period or the three weeks before it
const isMondayToSunday = (from: string, to: string) => new Date(`${from}T00:00:00Z`).getUTCDay() === 1 && daysBetween(from, to) === 7;

export async function projectsReport(q: { from?: string | null; to?: string | null; all?: boolean; kind?: string | null }) {
  const range = parseRange(q.from, q.to);
  const prev = previousRange(range);
  const wanted = KINDS.find((k) => k === q.kind) ?? null;
  const ctx = await loadContext();
  // The lookback range covers the period itself, so one query serves both.
  const [lookback, before] = await Promise.all([loadEntryRows(ctx, shiftDays(range.from, -ACTIVE_LOOKBACK_DAYS), range.to), loadEntryRows(ctx, prev.from, prev.to)]);
  const rows = lookback.filter((r) => r.entryDate >= range.from);
  const mine = ctx.liveProjects;
  const [rates, profiles, attention] = await Promise.all([
    ServiceProject.find({ _id: { $in: mine.map((p) => p._id) } }).select("contract.hourlyRateCents upworkProfileId").lean<Array<{ _id: string; upworkProfileId: string | null; contract: { hourlyRateCents: number | null } | null }>>(),
    ServiceUpworkProfile.find().select("name").lean<Array<{ _id: string; name: string }>>(),
    ServiceProject.find({ status: { $in: ATTENTION } }).sort({ name: 1 }).select("name status").lean<Array<{ _id: string; name: string; status: string }>>(),
  ]);
  const extra = new Map(rates.map((r) => [r._id, r]));
  const profileName = new Map(profiles.map((p) => [p._id, p.name]));
  const activeProjects = new Set(lookback.filter((r) => r.minutes > 0 && r.projectId).map((r) => r.projectId!));
  const byProject = new Map<string, Row[]>();
  for (const r of rows) if (r.projectId) byProject.set(r.projectId, [...(byProject.get(r.projectId) ?? []), r]);
  const week = isMondayToSunday(range.from, range.to);
  const working = workingDaysIn(range.from, range.to);

  const kindOf = (type: string, profileId: string | null | undefined): Kind => (/^direct$/i.test(profileName.get(profileId ?? "") ?? "") ? "direct" : type === "FIXED" ? "fixed" : "timer");
  const everyKindRow = mine.map((p) => {
    const c = p.contract!;
    const own = byProject.get(p._id) ?? [];
    const s = summarise(own, 0, working);
    const limit = week && c.type === "HOURLY" ? c.weeklyLimitMinutes : null;
    const rate = extra.get(p._id)?.contract?.hourlyRateCents ?? null;
    return {
      kind: kindOf(c.type, extra.get(p._id)?.upworkProfileId), projectId: p._id, projectName: p.name, projectStatus: p.status, contractType: c.type as "HOURLY" | "FIXED", inHouse: p.inHouse,
      minutes: s.minutes, timerMinutes: s.timerMinutes, manualMinutes: s.manualMinutes, activeDays: s.activeDays, entries: s.entries, flagged: s.flagged,
      // Weekly limit figures only make sense for exactly one Monday-to-Sunday week.
      weekly: week ? { limitMinutes: limit, remainingMinutes: limit === null ? null : Math.max(0, limit - s.minutes), overLimitMinutes: limit === null ? 0 : Math.max(0, s.minutes - limit), percentUsed: limit ? Math.round((s.minutes / limit) * 100) : null } : null,
      // Money from hours x rate; never for in-house work.
      amountCents: !p.inHouse && rate != null ? Math.round((s.minutes * rate) / 60) : null,
      // A closed project is listed only while it still has hours in the period.
      active: CLOSED.has(p.status) ? s.minutes > 0 : activeProjects.has(p._id),
      sharedClient: p.clientId ? ctx.shared.has(p.clientId) : false,
    };
  });
  const kinds = { direct: 0, fixed: 0, timer: 0 };
  for (const r of q.all ? everyKindRow : everyKindRow.filter((x) => x.active)) kinds[r.kind]++;
  const everyRow = wanted ? everyKindRow.filter((r) => r.kind === wanted) : everyKindRow;
  const inKind = new Set(everyRow.map((r) => r.projectId));
  const list = (q.all ? everyRow : everyRow.filter((r) => r.active)).sort((a, b) => b.minutes - a.minutes || a.projectName.localeCompare(b.projectName));
  return {
    range, previousRange: prev, weekMode: week,
    overview: {
      minutes: everyRow.reduce((n, r) => n + r.minutes, 0),
      previousMinutes: before.filter((r) => r.projectId && inKind.has(r.projectId)).reduce((n, r) => n + r.minutes, 0),
      activeClients: everyRow.filter((r) => r.minutes > 0).length,
      projectsWithHours: everyRow.filter((r) => r.minutes > 0).length,
      projectsTotal: everyRow.length,
      overLimit: everyRow.filter((r) => (r.weekly?.overLimitMinutes ?? 0) > 0).length,
      flagged: rows.filter((r) => r.flagged && (!wanted || (r.projectId && inKind.has(r.projectId)))).length,
      inHouseMinutes: rows.filter((r) => r.inHouse).reduce((n, r) => n + r.minutes, 0),
      unassignedMinutes: rows.filter((r) => r.projectId === null && !r.inHouse).reduce((n, r) => n + r.minutes, 0),
    },
    kinds,
    hiddenInactive: everyRow.length - list.length,
    rows: list,
    attention: attention.map((p) => ({ id: p._id, name: p.name, status: p.status })),
  };
}
export type ProjectsReport = Awaited<ReturnType<typeof projectsReport>>;

// --- Teams tab ------------------------------------------------------------------------------------------------------------

const deptLabel = (d: { managerName: string | null }) => d.managerName;

export async function teamsReport(q: { from?: string | null; to?: string | null }) {
  const range = parseRange(q.from, q.to);
  const ctx = await loadContext();
  const { people: withRows, previousRange: prev, workingDays } = await buildPeople(ctx, range);
  const shown = withRows.map(({ rows: _rows, ...p }) => p); // eslint-disable-line @typescript-eslint/no-unused-vars
  const active = shown.filter((p) => p.minutes > 0);
  const minutes = shown.reduce((n, p) => n + p.minutes, 0);

  // Split by department: a person appears under every department whose projects they worked on, with only those hours.
  const groups = ctx.departments.length === 0 ? [] : [
    ...ctx.departments.map((d) => ({ id: d._id as string | null, name: d.name, manager: deptLabel(d), isDefault: d.isDefault })),
    { id: null as string | null, name: "Not on a project", manager: null, isDefault: false },
  ]
    .map((g) => {
      const members = withRows
        .map((p) => {
          const mine = p.rows.filter((r) => r.departmentId === g.id);
          const { rows: _all, ...base } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
          return { ...base, ...summarise(mine, 0, workingDays) };
        })
        .filter((p) => p.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
      return { ...g, minutes: members.reduce((n, m) => n + m.minutes, 0), people: members };
    })
    .filter((g) => g.minutes > 0 || g.id !== null)
    .sort((a, b) => b.minutes - a.minutes);

  return {
    range, previousRange: prev, workingDays,
    overview: {
      minutes, previousMinutes: shown.reduce((n, p) => n + p.previousMinutes, 0), people: active.length,
      avgPerPerson: active.length ? Math.round(minutes / active.length) : 0,
      timerMinutes: shown.reduce((n, p) => n + p.timerMinutes, 0), manualMinutes: shown.reduce((n, p) => n + p.manualMinutes, 0),
      flagged: shown.reduce((n, p) => n + p.flagged, 0),
      topPerson: active[0] ? { name: active[0].name, minutes: active[0].minutes } : null,
    },
    people: shown,
    groups,
  };
}
export type TeamsReport = Awaited<ReturnType<typeof teamsReport>>;
export type TeamPerson = TeamsReport["people"][number];

// --- Departments tab ------------------------------------------------------------------------------------------------------

export async function departmentsReport(q: { from?: string | null; to?: string | null }) {
  const range = parseRange(q.from, q.to);
  const prev = previousRange(range);
  const ctx = await loadContext();
  const [rows, before, senders] = await Promise.all([
    loadEntryRows(ctx, range.from, range.to),
    loadEntryRows(ctx, prev.from, prev.to),
    ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>(),
  ]);
  const nameOf = new Map(senders.map((s) => [s.externalId, s.displayName]));
  const working = workingDaysIn(range.from, range.to);

  const build = (id: string | null, name: string, manager: string | null, isDefault: boolean) => {
    const mine = rows.filter((r) => r.departmentId === id);
    const s = summarise(mine, before.filter((r) => r.departmentId === id).reduce((n, r) => n + r.minutes, 0), working);
    const byPerson = new Map<string, number>();
    for (const r of mine) byPerson.set(r.senderKey, (byPerson.get(r.senderKey) ?? 0) + r.minutes);
    const people = [...byPerson].map(([key, minutes]) => ({ name: nameOf.get(key) ?? key, minutes })).filter((p) => p.minutes > 0).sort((a, b) => b.minutes - a.minutes);
    return {
      id, name, manager, isDefault, minutes: s.minutes, previousMinutes: s.previousMinutes, timerMinutes: s.timerMinutes, manualMinutes: s.manualMinutes,
      projectCount: new Set(mine.filter((r) => r.projectId).map((r) => r.projectId)).size, activePeople: people.length,
      avgPerPerson: people.length ? Math.round(s.minutes / people.length) : 0, flagged: s.flagged,
      projects: s.projects.slice(0, 5), people: people.slice(0, 8),
    };
  };
  const list = ctx.departments.map((d) => build(d._id, d.name, d.managerName, d.isDefault));
  // Hours on no project (unknown client, in-house work) belong to no department.
  const none = build(null, "Not on a project", null, false);
  const out = (none.minutes > 0 ? [...list, none] : list).sort((a, b) => b.minutes - a.minutes);
  const total = out.reduce((n, d) => n + d.minutes, 0);
  const best = out[0];
  return {
    range, previousRange: prev,
    overview: {
      minutes: total, previousMinutes: out.reduce((n, d) => n + d.previousMinutes, 0),
      departments: ctx.departments.length, departmentsWithHours: out.filter((d) => d.minutes > 0 && d.id !== null).length,
      noManagerSet: ctx.departments.filter((d) => !d.isDefault && !d.managerUserId).length,
      top: best && best.minutes > 0 ? { name: best.name, minutes: best.minutes } : null,
    },
    departments: out,
  };
}
export type DepartmentsReport = Awaited<ReturnType<typeof departmentsReport>>;
