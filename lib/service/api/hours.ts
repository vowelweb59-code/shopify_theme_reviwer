import "server-only";
// Contracts and Upwork-style weekly hours (ported from the Upwork app's hours.controller.ts). One shared login: everyone
// signed in sees rates and fixed prices too (owner decision for this port).
import { badRequest, day, int, isoDay, notFound, oneOf, str } from "./http";
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { istDate } from "../import/text";
import { weekOf, type Week } from "../import/week";
import { weeklyHours, type HourEntry, type WeeklyHours } from "../import/weekly-hours";
import { recordServiceAudit } from "../audit/record";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

const DAY_MS = 86_400_000;
const shiftDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);

// Hours count as soon as they are imported; review only corrects them afterwards (owner: do not wait for review).
const isConfirmed = (e: { state: string }) => e.state !== "REJECTED";
const isPending = (e: { state: string }) => e.state === "NEEDS_REVIEW";

export type Contract = {
  projectId: string;
  type: "HOURLY" | "FIXED";
  weeklyLimitMinutes: number | null;
  hourlyRateCents: number | null;
  fixedPriceCents: number | null;
  trackingMode: "TIMER" | "MANUAL" | null;
  externalRef: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "ACTIVE" | "PAUSED" | "ENDED";
};

export type EntryLite = {
  _id: string;
  projectId: string | null;
  clientId: string | null;
  minutes: number;
  entryDate: Date;
  source: "TIMER_CALCULATED" | "MANUAL_REPORT";
  state: string;
  senderExternalId: string;
  allocations: Array<{ projectId: string; minutes: number }>;
};

export function weekParam(raw?: string | null): Week {
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw badRequest("week must be YYYY-MM-DD");
  return weekOf(raw || istDate(new Date()));
}

const range = (w: { start: string; end: string }) => ({ $gte: new Date(`${w.start}T00:00:00Z`), $lte: new Date(`${w.end}T00:00:00Z`) });

/** Counted entries in a period. An entry shared across projects comes back once per share, with that share of the minutes. */
export async function entriesFor(scope: { clientId: string | null; projectId: string } | "ANY", period: { start: string; end: string }): Promise<EntryLite[]> {
  const where: Record<string, unknown> = { state: { $ne: "REJECTED" }, entryDate: range(period) };
  if (scope !== "ANY") {
    where.$or = [
      { projectId: scope.projectId },
      { "allocations.projectId": scope.projectId },
      ...(scope.clientId ? [{ projectId: null, clientId: scope.clientId, allocations: { $size: 0 } }] : []),
    ];
  }
  const rows = await ServiceTimeEntry.find(where).select("projectId clientId minutes entryDate source state senderExternalId allocations").lean<EntryLite[]>();
  return expandAllocations(rows);
}

export async function senderNames(): Promise<Map<string, string>> {
  const rows = await ServiceChatSender.find().select("externalId displayName").lean<Array<{ externalId: string; displayName: string }>>();
  return new Map(rows.map((s) => [s.externalId, s.displayName]));
}

type ProjectRow = { _id: string; name: string; clientId: string | null; upworkAccountId: string | null; status: string; contract: (Omit<Contract, "projectId" | "startDate" | "endDate"> & { startDate: Date | null; endDate: Date | null }) | null };

async function project(id: string): Promise<ProjectRow> {
  const p = await ServiceProject.findById(id).select("name clientId upworkAccountId status contract").lean<ProjectRow | null>();
  if (!p) throw notFound("Project not found.");
  return p;
}

function shape(p: ProjectRow): Contract | null {
  const c = p.contract;
  if (!c) return null;
  return {
    projectId: p._id, type: c.type, weeklyLimitMinutes: c.weeklyLimitMinutes ?? null, hourlyRateCents: c.hourlyRateCents ?? null, fixedPriceCents: c.fixedPriceCents ?? null,
    trackingMode: c.trackingMode ?? null, externalRef: c.externalRef ?? null, startDate: day(c.startDate), endDate: day(c.endDate), status: c.status,
  };
}

export async function getContract(id: string) {
  return shape(await project(id));
}

export async function putContract(id: string, body: Record<string, unknown>) {
  const p = await project(id);
  const allowed = new Set(["type", "weeklyLimitMinutes", "hourlyRateCents", "fixedPriceCents", "trackingMode", "externalRef", "startDate", "endDate", "status"]);
  for (const k of Object.keys(body)) if (!allowed.has(k)) throw badRequest(`Unknown field: ${k}`);
  const cur = p.contract;
  const next = {
    type: oneOf(body.type ?? cur?.type ?? "HOURLY", "type", ["HOURLY", "FIXED"] as const),
    weeklyLimitMinutes: "weeklyLimitMinutes" in body ? int(body.weeklyLimitMinutes, "weeklyLimitMinutes", { min: 1, max: 168 * 60, optional: true }) : cur?.weeklyLimitMinutes ?? null,
    hourlyRateCents: "hourlyRateCents" in body ? int(body.hourlyRateCents, "hourlyRateCents", { max: 1_000_000, optional: true }) : cur?.hourlyRateCents ?? null,
    fixedPriceCents: "fixedPriceCents" in body ? int(body.fixedPriceCents, "fixedPriceCents", { max: 100_000_000, optional: true }) : cur?.fixedPriceCents ?? null,
    trackingMode: "trackingMode" in body ? (body.trackingMode === null ? null : oneOf(body.trackingMode, "trackingMode", ["TIMER", "MANUAL"] as const)) : cur?.trackingMode ?? null,
    externalRef: "externalRef" in body ? str(body.externalRef, "externalRef", { optional: true }) : cur?.externalRef ?? null,
    startDate: "startDate" in body ? isoDay(body.startDate, "startDate") : cur?.startDate ?? null,
    endDate: "endDate" in body ? isoDay(body.endDate, "endDate") : cur?.endDate ?? null,
    status: oneOf(body.status ?? cur?.status ?? "ACTIVE", "status", ["ACTIVE", "PAUSED", "ENDED"] as const),
  };
  await ServiceProject.updateOne({ _id: id }, { $set: { contract: next } });
  await recordServiceAudit("contract.set", { projectId: id, type: next.type, weeklyLimitMinutes: next.weeklyLimitMinutes, rateChanged: "hourlyRateCents" in body || "fixedPriceCents" in body });
  return shape(await project(id));
}

export type ProjectWeek = {
  week: Week;
  contract: Contract | null;
  hours: WeeklyHours | null;
  reason: "NO_CONTRACT" | null;
  sharedClient?: boolean;
  unassignedEntries?: number;
  byDay?: Array<{ date: string; minutes: number }>;
  bySender?: Array<{ name: string; minutes: number }>;
  needsReview?: number;
};

export async function projectWeek(id: string, weekRaw?: string | null): Promise<ProjectWeek> {
  const p = await project(id);
  const week = weekParam(weekRaw);
  const contract = shape(p);
  if (!contract) return { week, contract: null, hours: null, reason: "NO_CONTRACT" };
  const [{ owner, shared }, names] = await Promise.all([loadAttribution(), senderNames()]);
  const all = await entriesFor({ clientId: p.clientId, projectId: id }, week);
  // Entries of a client with several projects count here only when they were placed on this one.
  const entries = all.filter((e) => projectOf(e, owner) === id);
  const hourEntries: HourEntry[] = entries.map((e) => ({ date: day(e.entryDate)!, minutes: e.minutes, source: e.source, confirmed: isConfirmed(e) }));
  const hours = weeklyHours(hourEntries, contract.weeklyLimitMinutes, week.start);
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(week.start, i);
    return { date: d, minutes: hourEntries.filter((e) => e.date === d && e.confirmed).reduce((n, e) => n + e.minutes, 0) };
  });
  const bySender = new Map<string, number>();
  for (const e of entries) if (isConfirmed(e)) {
    const n = names.get(e.senderExternalId) ?? "Unknown sender";
    bySender.set(n, (bySender.get(n) ?? 0) + e.minutes);
  }
  return {
    week, contract, reason: null, sharedClient: !!p.clientId && shared.has(p.clientId), unassignedEntries: all.length - entries.length, hours, byDay,
    bySender: [...bySender].map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes),
    needsReview: entries.filter(isPending).length,
  };
}

/** Who worked how much on a project: hours per person for the chosen week, the last 30 days and everything reported. */
export async function teamHours(id: string, weekRaw?: string | null) {
  const p = await project(id);
  const week = weekParam(weekRaw);
  if (!p.contract) return { week, rows: [] as Array<{ name: string; week: number; last30: number; total: number; lastReport: string }> };
  const [{ owner }, names] = await Promise.all([loadAttribution(), senderNames()]);
  const today = istDate(new Date());
  const since = shiftDays(today, -29);
  const all = (await entriesFor({ clientId: p.clientId, projectId: id }, { start: "2000-01-01", end: "2100-01-01" })).filter((e) => projectOf(e, owner) === id && e.minutes > 0);
  const people = new Map<string, { name: string; week: number; last30: number; total: number; lastReport: string }>();
  for (const e of all) {
    const name = names.get(e.senderExternalId) ?? "Unknown sender";
    const d = day(e.entryDate)!;
    const row = people.get(name) ?? { name, week: 0, last30: 0, total: 0, lastReport: d };
    row.total += e.minutes;
    if (d >= since && d <= today) row.last30 += e.minutes;
    if (d >= week.start && d <= week.end) row.week += e.minutes;
    if (d > row.lastReport) row.lastReport = d;
    people.set(name, row);
  }
  return { week, rows: [...people.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)) };
}

export type LiveReport = {
  id: string;
  entryDate: string;
  postedAt: string;
  sender: string;
  client: string | null;
  inHouse: boolean;
  project: string | null;
  source: "TIMER_CALCULATED" | "MANUAL_REPORT";
  minutes: number;
  memo: string | null;
  late: boolean;
  flagged: boolean;
};

/** The newest counted entries, as they arrive (newest Chat post first). */
export async function liveReports(limitRaw?: string | null): Promise<LiveReport[]> {
  const limit = Math.min(Math.max(Number(limitRaw) || 40, 1), 100);
  const rows = await ServiceTimeEntry.aggregate<EntryLite & { memo: string | null; isLate: boolean; msg: { postedAt: Date; senderName: string } }>([
    { $match: { state: { $ne: "REJECTED" }, minutes: { $gt: 0 } } },
    { $sort: { entryDate: -1 } },
    { $limit: limit * 20 }, // newest days first, then order by posting time among them
    { $lookup: { from: "service_chat_messages", localField: "sourceMessageId", foreignField: "_id", as: "msg", pipeline: [{ $project: { postedAt: 1, senderName: 1 } }] } },
    { $unwind: "$msg" },
    { $sort: { "msg.postedAt": -1 } },
    { $limit: limit },
  ]);
  const { projects, owner } = await loadAttribution();
  const projectName = new Map(projects.map((p) => [p._id, p.name]));
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((x): x is string => !!x))];
  const clients = new Map((await ServiceClient.find({ _id: { $in: clientIds } }).select("name inHouse").lean<Array<{ _id: string; name: string; inHouse: boolean }>>()).map((c) => [c._id, c]));
  return rows.map((e) => {
    const pids = e.allocations?.length ? e.allocations.map((a) => a.projectId) : [projectOf(e, owner)];
    const c = e.clientId ? clients.get(e.clientId) : undefined;
    return {
      id: e._id, entryDate: day(e.entryDate)!, postedAt: new Date(e.msg.postedAt).toISOString(), sender: e.msg.senderName, client: c?.name ?? null, inHouse: c?.inHouse ?? false,
      project: pids.map((x) => (x ? projectName.get(x) : null)).filter(Boolean).join(" + ") || null,
      source: e.source, minutes: e.minutes, memo: e.memo, late: e.isLate, flagged: e.state === "NEEDS_REVIEW",
    };
  });
}

export type DashboardRow = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  contractType: "HOURLY" | "FIXED";
  contractStatus: string;
  hours: WeeklyHours;
  needsReview: number;
  idle: boolean;
  unassigned: boolean;
  sharedClient: boolean;
  active: boolean;
};

/** One row per live contract, Upwork style: completed, limit, remaining. Inactive ones (no hours in 4 weeks) hidden unless `all`. */
export async function dashboardWeek(weekRaw?: string | null, all = false) {
  const week = weekParam(weekRaw);
  const { projects, owner, shared } = await loadAttribution();
  const [entries, recent, inHouseRows] = await Promise.all([
    entriesFor("ANY", week),
    entriesFor("ANY", { start: shiftDays(week.start, -21), end: week.end }),
    ServiceClient.find({ inHouse: true }).select("_id").lean<Array<{ _id: string }>>(),
  ]);
  const activeProjects = new Set(recent.filter((e) => e.minutes > 0).map((e) => projectOf(e, owner)).filter((x): x is string => x !== null));
  const byProject = new Map<string, EntryLite[]>();
  for (const e of entries) {
    const pid = projectOf(e, owner);
    if (pid) byProject.set(pid, [...(byProject.get(pid) ?? []), e]);
  }
  const everyRow: DashboardRow[] = projects.map((p) => {
    const own = byProject.get(p._id) ?? [];
    const sharedClient = p.clientId ? shared.has(p.clientId) : false;
    const c = p.contract!;
    return {
      projectId: p._id, projectName: p.name, projectStatus: p.status, contractType: c.type as "HOURLY" | "FIXED", contractStatus: c.status,
      hours: weeklyHours(own.map((e) => ({ date: day(e.entryDate)!, minutes: e.minutes, source: e.source, confirmed: isConfirmed(e) })), c.weeklyLimitMinutes, week.start),
      needsReview: own.filter(isPending).length,
      idle: c.status === "ACTIVE" && c.type === "HOURLY" && own.length === 0 && !sharedClient,
      unassigned: false, sharedClient, active: activeProjects.has(p._id),
    };
  });
  const rows = all ? everyRow : everyRow.filter((r) => r.active);
  const inHouseIds = new Set(inHouseRows.map((c) => c._id));
  const isInHouse = (e: EntryLite) => !!e.clientId && inHouseIds.has(e.clientId);
  const loose = entries.filter((e) => projectOf(e, owner) === null && !isInHouse(e));
  const inHouse = entries.filter(isInHouse);
  return {
    week, rows, hiddenInactive: everyRow.length - rows.length,
    inHouse: { entries: inHouse.length, minutes: inHouse.filter(isConfirmed).reduce((n, e) => n + e.minutes, 0) },
    unassigned: { entries: loose.length, minutes: loose.filter(isConfirmed).reduce((n, e) => n + e.minutes, 0), needsReview: loose.filter(isPending).length },
  };
}

