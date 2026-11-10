import "server-only";
// Service projects: registry, list filters, status changes, assignments, and the extra fields on a project page (people,
// review, Upwork profile, in-house, Chat keywords), plus bulk edit. Ported from the Upwork app's projects.controller.ts,
// project-details.controller.ts and bulk.controller.ts. One shared login: no permission checks, every viewer sees money.
import { randomUUID } from "node:crypto";
import { badRequest, bool, day, isoDay, notFound, oneOf, str, strList } from "./http";
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { autoAssignProjects } from "../hours/auto-assign";
import { normalizeName } from "../import/text";
import { recordServiceAudit } from "../audit/record";
import { applyActivityRules } from "../projects/activity-rules";
import { matchSender } from "../projects/sender-name";
import { validateTransition } from "../projects/transitions";
import { loadProjectDepartments } from "../reports/project-departments";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { SERVICE_PROJECT_STATUSES, type ServicePersonRole, type ServiceProjectStatus } from "@/models/service-shared";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkContract, ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceUser } from "@/models/service-user";

type Person = { role: ServicePersonRole; name: string; senderId: string | null };
type Assignment = { userId: string; role: "MANAGER" | "EMPLOYEE" };
type ProjectDoc = {
  _id: string;
  name: string;
  clientId: string | null;
  upworkAccountId: string | null;
  upworkProfileId: string | null;
  chatKeywords: string[];
  inHouse: boolean;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
  contractRef: string | null;
  description: string | null;
  projectType: string | null;
  status: ServiceProjectStatus;
  startDate: Date | null;
  targetDate: Date | null;
  revisedDate: Date | null;
  createdAt: Date;
  people: Person[];
  assignments: Assignment[];
  history: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; at: Date }>;
  contract: { type: "HOURLY" | "FIXED"; weeklyLimitMinutes: number | null; hourlyRateCents: number | null; fixedPriceCents: number | null; trackingMode: "TIMER" | "MANUAL" | null; status: string } | null;
};

export type ProjectKind = "timer" | "fixed" | "direct" | "inhouse";

export type ServiceProjectView = {
  id: string;
  name: string;
  status: ServiceProjectStatus;
  contractRef: string | null;
  description: string | null;
  projectType: string | null;
  startDate: string | null;
  targetDate: string | null;
  revisedDate: string | null;
  createdAt: string;
};

export type ProjectListRow = ServiceProjectView & {
  inHouse: boolean;
  kind: ProjectKind;
  department: { id: string; name: string } | null;
  businessAnalysts: string[];
  businessDevelopers: string[];
  projectManagers: string[];
  reviewRating: number | null;
  weeklyLimitMinutes: number | null;
  hourlyRateCents: number | null;
  fixedPriceCents: number | null;
  minutes?: number;
  minutesLast30?: number;
};

const view = (p: ProjectDoc): ServiceProjectView => ({
  id: p._id, name: p.name, status: p.status, contractRef: p.contractRef ?? null, description: p.description ?? null, projectType: p.projectType ?? null,
  startDate: day(p.startDate), targetDate: day(p.targetDate), revisedDate: day(p.revisedDate), createdAt: new Date(p.createdAt).toISOString(),
});

async function find(id: string): Promise<ProjectDoc> {
  const p = await ServiceProject.findById(id).lean<ProjectDoc | null>();
  if (!p) throw notFound("Project not found.");
  return p;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- list ---------------------------------------------------------------------------------------------------------------

/** Choices for the list filters and the bulk-edit bar. */
export async function filterOptions() {
  const roleNames = async (role: ServicePersonRole) => {
    const rows = await ServiceProject.aggregate<{ _id: string }>([{ $unwind: "$people" }, { $match: { "people.role": role } }, { $group: { _id: "$people.name" } }]);
    return rows.map((r) => r._id).sort((a, b) => a.localeCompare(b));
  };
  const [{ departments }, businessAnalysts, businessDevelopers, profiles, users] = await Promise.all([
    loadProjectDepartments(),
    roleNames("BUSINESS_ANALYST"),
    roleNames("BUSINESS_DEVELOPER"),
    ServiceUpworkProfile.find().select("name").sort({ name: 1 }).lean<Array<{ _id: string; name: string }>>(),
    assignableUsers(),
  ]);
  return {
    departments: departments.map((d) => ({ id: d._id, name: d.name })),
    businessAnalysts,
    businessDevelopers,
    canBulkEdit: true,
    profiles: profiles.map((p) => ({ id: p._id, name: p.name })),
    users,
  };
}

export type ListQuery = { status?: string | null; q?: string | null; department?: string | null; ba?: string | null; bd?: string | null; hours?: boolean };

export async function listProjects(query: ListQuery): Promise<ProjectListRow[]> {
  const { status, q, department, ba, bd } = query;
  if (status && !(SERVICE_PROJECT_STATUSES as readonly string[]).includes(status)) throw badRequest("unknown status");
  const { departments, deptOf } = await loadProjectDepartments();
  if (department && !departments.some((d) => d._id === department)) throw badRequest("unknown department");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) where.name = { $regex: escapeRegex(q), $options: "i" };
  if (department) where._id = { $in: [...deptOf].filter(([, d]) => d === department).map(([id]) => id) };
  // BA and BD are different teams: each is its own filter, and both can apply at once.
  const and: unknown[] = [];
  if (ba) and.push({ people: { $elemMatch: { role: "BUSINESS_ANALYST", name: { $regex: `^${escapeRegex(ba)}$`, $options: "i" } } } });
  if (bd) and.push({ people: { $elemMatch: { role: "BUSINESS_DEVELOPER", name: { $regex: `^${escapeRegex(bd)}$`, $options: "i" } } } });
  if (and.length) where.$and = and;

  const [rows, users, inHouseClients, profiles] = await Promise.all([
    ServiceProject.find(where).sort({ createdAt: -1 }).lean<ProjectDoc[]>(),
    ServiceUser.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
    ServiceClient.find({ inHouse: true }).select("_id").lean<Array<{ _id: string }>>(),
    ServiceUpworkProfile.find().select("name").lean<Array<{ _id: string; name: string }>>(),
  ]);
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  const inHouseClient = new Set(inHouseClients.map((c) => c._id));
  const profileName = new Map(profiles.map((p) => [p._id, p.name]));
  const deptName = new Map(departments.map((d) => [d._id, d.name]));
  const leads = new Set(departments.flatMap((d) => (d.managerUserId ? [d.managerUserId] : []))); // the department managers

  // Hours per project (all reported, and the last 30 days), only when asked.
  const hours = new Map<string, { total: number; last30: number }>();
  if (query.hours) {
    const att = await loadAttribution();
    const since = new Date(Date.now() - 30 * 86_400_000);
    const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
      .select("projectId clientId minutes entryDate allocations")
      .lean<Array<{ projectId: string | null; clientId: string | null; minutes: number; entryDate: Date; allocations: Array<{ projectId: string; minutes: number }> }>>();
    for (const e of expandAllocations(entries)) {
      const pid = projectOf(e, att.owner);
      if (!pid) continue;
      const h = hours.get(pid) ?? { total: 0, last30: 0 };
      h.total += e.minutes;
      if (e.entryDate >= since) h.last30 += e.minutes;
      hours.set(pid, h);
    }
  }

  const sortedNames = (people: Person[], role: ServicePersonRole) => people.filter((x) => x.role === role).map((x) => x.name).sort((a, b) => a.localeCompare(b));
  return rows.map((r) => {
    const inHouse = r.inHouse || (!!r.clientId && inHouseClient.has(r.clientId));
    const dept = deptOf.get(r._id);
    return {
      ...view(r),
      inHouse,
      // In-house = our own work. Otherwise: Direct = paid outside Upwork (the Direct profile), Fixed = fixed-price contract, Timer = the rest.
      kind: inHouse ? "inhouse" : /^direct$/i.test(profileName.get(r.upworkProfileId ?? "") ?? "") ? "direct" : r.contract?.type === "FIXED" ? "fixed" : "timer",
      department: dept ? { id: dept, name: deptName.get(dept)! } : null,
      businessAnalysts: sortedNames(r.people, "BUSINESS_ANALYST"),
      businessDevelopers: sortedNames(r.people, "BUSINESS_DEVELOPER"),
      projectManagers: r.assignments.filter((a) => a.role === "MANAGER" && leads.has(a.userId)).map((a) => userName.get(a.userId) ?? "Unknown"),
      reviewRating: r.reviewRating ?? null,
      weeklyLimitMinutes: r.contract?.weeklyLimitMinutes ?? null,
      hourlyRateCents: r.contract?.hourlyRateCents ?? null,
      fixedPriceCents: r.contract?.fixedPriceCents ?? null,
      ...(query.hours ? { minutes: hours.get(r._id)?.total ?? 0, minutesLast30: hours.get(r._id)?.last30 ?? 0 } : {}),
    } satisfies ProjectListRow;
  });
}

// --- one project ----------------------------------------------------------------------------------------------------

export async function getProject(id: string) {
  return view(await find(id));
}

function projectFields(body: Record<string, unknown>, partial: boolean) {
  const allowed = new Set(["name", "contractRef", "description", "projectType", "startDate", "targetDate", "revisedDate"]);
  for (const k of Object.keys(body)) if (!allowed.has(k)) throw badRequest(`Unknown field: ${k}`);
  const out: Record<string, unknown> = {};
  if (!partial || "name" in body) out.name = str(body.name, "name", { max: 200 });
  if ("contractRef" in body) out.contractRef = str(body.contractRef, "contractRef", { optional: true });
  if ("description" in body) out.description = str(body.description, "description", { max: 5000, optional: true });
  if ("projectType" in body) out.projectType = str(body.projectType, "projectType", { max: 100, optional: true });
  for (const k of ["startDate", "targetDate", "revisedDate"]) if (k in body) out[k] = isoDay(body[k], k);
  return out;
}

export async function createProject(body: Record<string, unknown>) {
  const data = projectFields(body, false);
  const doc = await ServiceProject.create({ _id: randomUUID(), ...data });
  await recordServiceAudit("project.create", { projectId: doc._id, name: data.name });
  return getProject(String(doc._id));
}

export async function patchProject(id: string, body: Record<string, unknown>) {
  await find(id);
  const data = projectFields(body, true);
  await ServiceProject.updateOne({ _id: id }, { $set: data });
  await recordServiceAudit("project.update", { projectId: id, fields: Object.keys(data) });
  return getProject(id);
}

export async function changeStatus(id: string, body: Record<string, unknown>) {
  const p = await find(id);
  const to = oneOf(body.to, "to", SERVICE_PROJECT_STATUSES);
  const reason = str(body.reason, "reason", { max: 1000, optional: true }) ?? undefined;
  const check = validateTransition(p.status, to, reason);
  if (!check.ok) throw badRequest(check.error);
  // Conditional on the status read, so two people moving the same project at once cannot both win.
  const r = await ServiceProject.updateOne({ _id: id, status: p.status }, { $set: { status: to }, $push: { history: { fromStatus: p.status, toStatus: to, reason: reason ?? null, at: new Date() } } });
  if (r.modifiedCount === 0) throw badRequest("The project changed meanwhile. Reload and try again.");
  await recordServiceAudit("project.status", { projectId: id, from: p.status, to, reason: reason ?? null });
  return getProject(id);
}

/** Picker source for assignments: active management users. */
export async function assignableUsers() {
  const rows = await ServiceUser.find({ active: true, kind: "MANAGEMENT" }).select("displayName").sort({ displayName: 1 }).lean<Array<{ _id: string; displayName: string }>>();
  return rows.map((u) => ({ id: u._id, displayName: u.displayName }));
}

export type AssignmentView = { userId: string; assignmentRole: "MANAGER" | "EMPLOYEE"; user: { id: string; displayName: string } };

export async function getAssignments(id: string): Promise<AssignmentView[]> {
  const p = await find(id);
  const users = await ServiceUser.find({ _id: { $in: p.assignments.map((a) => a.userId) } }).select("displayName").lean<Array<{ _id: string; displayName: string }>>();
  const name = new Map(users.map((u) => [u._id, u.displayName]));
  return p.assignments.map((a) => ({ userId: a.userId, assignmentRole: a.role, user: { id: a.userId, displayName: name.get(a.userId) ?? "Unknown" } }));
}

export async function setAssignments(id: string, body: Record<string, unknown>) {
  await find(id);
  if (!Array.isArray(body.assignments) || body.assignments.length > 100) throw badRequest("assignments must be a list (max 100).");
  const list = (body.assignments as unknown[]).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { userId: str(o.userId, "userId", { max: 64 })!, role: oneOf(o.assignmentRole, "assignmentRole", ["MANAGER", "EMPLOYEE"] as const) };
  });
  if (new Set(list.map((x) => `${x.userId}:${x.role}`)).size !== list.length) throw badRequest("duplicate assignment");
  const ids = [...new Set(list.map((x) => x.userId))];
  if ((await ServiceUser.countDocuments({ _id: { $in: ids }, active: true })) !== ids.length) throw badRequest("unknown or inactive user");
  await ServiceProject.updateOne({ _id: id }, { $set: { assignments: list } });
  await recordServiceAudit("project.assignments_set", { projectId: id, count: list.length });
  return getAssignments(id);
}

// --- details ---------------------------------------------------------------------------------------------------------

export type ProjectDetails = {
  chatKeywords: string[];
  inHouse: boolean;
  upworkProfile: { id: string; name: string } | null;
  review: { rating: number | null; comment: string | null; reviewedAt: string | null };
  managers: Array<{ id: string; displayName: string }>;
  businessAnalysts: Array<{ name: string; linked: boolean }>;
  executives: Array<{ name: string; linked: boolean }>;
  businessDevelopers: Array<{ name: string; linked: boolean }>;
  upworkContracts: Array<{ ref: string; profile: string | null; bde: string | null; ba: string | null; url: string | null; endedBy: string | null; startDate: string | null; endDate: string | null; rating: number | null; duration: string | null }>;
  canEdit: boolean;
  canSeeMoney: boolean;
  suggestions: string[];
  profiles: Array<{ id: string; name: string }>;
};

export async function getDetails(id: string): Promise<ProjectDetails> {
  const p = await find(id);
  const [contracts, users, profile, senders, profiles] = await Promise.all([
    ServiceUpworkContract.find({ projectId: id }).sort({ startDate: -1, sheetRef: -1 }).lean<Array<{ sheetRef: string; profile: string | null; bde: string | null; ba: string | null; url: string | null; endedBy: string | null; startDate: Date | null; endDate: Date | null; finalRating: number | null; changedRating: number | null; duration: string | null }>>(),
    ServiceUser.find({ _id: { $in: p.assignments.filter((a) => a.role === "MANAGER").map((a) => a.userId) } }).select("displayName").lean<Array<{ _id: string; displayName: string }>>(),
    p.upworkProfileId ? ServiceUpworkProfile.findById(p.upworkProfileId).select("name").lean<{ _id: string; name: string } | null>() : null,
    ServiceChatSender.find().select("displayName").sort({ displayName: 1 }).lean<Array<{ displayName: string }>>(),
    ServiceUpworkProfile.find().select("name").sort({ name: 1 }).lean<Array<{ _id: string; name: string }>>(),
  ]);
  const people = [...p.people].sort((a, b) => a.name.localeCompare(b.name));
  const names = (role: ServicePersonRole) => people.filter((x) => x.role === role).map((x) => ({ name: x.name, linked: x.senderId !== null }));
  return {
    upworkProfile: profile ? { id: profile._id, name: profile.name } : null,
    chatKeywords: p.chatKeywords,
    inHouse: p.inHouse,
    review: { rating: p.reviewRating ?? null, comment: p.reviewComment ?? null, reviewedAt: p.reviewedAt ? new Date(p.reviewedAt).toISOString() : null },
    managers: users.map((u) => ({ id: u._id, displayName: u.displayName })),
    businessAnalysts: names("BUSINESS_ANALYST"),
    executives: names("EXECUTIVE"),
    businessDevelopers: names("BUSINESS_DEVELOPER"),
    upworkContracts: contracts.map((c) => ({
      ref: c.sheetRef, profile: c.profile, bde: c.bde, ba: c.ba, url: c.url, endedBy: c.endedBy, startDate: day(c.startDate), endDate: day(c.endDate),
      rating: c.changedRating ?? c.finalRating ?? null, duration: c.duration,
    })),
    canEdit: true,
    canSeeMoney: true,
    suggestions: [...new Set(senders.map((s) => s.displayName))],
    profiles: profiles.map((x) => ({ id: x._id, name: x.name })),
  };
}

async function senderList() {
  return (await ServiceChatSender.find().select("displayName").lean<Array<{ _id: string; displayName: string }>>()).map((s) => ({ id: s._id, displayName: s.displayName }));
}

const personNames = (v: unknown, field: string, max: number) => {
  const list = strList(v, field, { max, each: 80 });
  for (const n of list) if (n.length < 2) throw badRequest(`${field}: names need at least 2 characters.`);
  return list;
};

/** Replaces the lists sent (BA and executives, and business developers when given). A name matching a Chat sender is linked. */
export async function setPeople(id: string, body: Record<string, unknown>) {
  const p = await find(id);
  const lists: Array<[ServicePersonRole, string[]]> = [
    ["BUSINESS_ANALYST", personNames(body.businessAnalysts, "businessAnalysts", 30)],
    ["EXECUTIVE", personNames(body.executives, "executives", 50)],
    ...(body.businessDevelopers !== undefined ? [["BUSINESS_DEVELOPER", personNames(body.businessDevelopers, "businessDevelopers", 30)] as [ServicePersonRole, string[]]] : []),
  ];
  const senders = await senderList();
  const replaced = new Set(lists.map(([r]) => r));
  const rows: Person[] = p.people.filter((x) => !replaced.has(x.role));
  let saved = 0;
  for (const [role, list] of lists) {
    const seen = new Set<string>();
    for (const name of list) {
      const key = normalizeName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ role, name, senderId: matchSender(name, senders) });
      saved++;
    }
  }
  await ServiceProject.updateOne({ _id: id }, { $set: { people: rows } });
  await recordServiceAudit("project.people_set", { projectId: id, businessAnalysts: lists[0][1].length, executives: lists[1][1].length });
  return { saved };
}

export async function setReview(id: string, body: Record<string, unknown>) {
  await find(id);
  const raw = body.rating;
  let rating: number | null = null;
  if (raw !== null && raw !== undefined) {
    if (typeof raw !== "number" || raw < 1 || raw > 5 || Math.abs(raw * 10 - Math.round(raw * 10)) > 1e-9) throw badRequest("rating must be 1 to 5, one decimal at most.");
    rating = raw;
  }
  const comment = str(body.comment, "comment", { max: 2000, optional: true });
  if (rating === null && comment) throw badRequest("a comment needs a rating");
  await ServiceProject.updateOne({ _id: id }, { $set: { reviewRating: rating, reviewComment: rating === null ? null : comment, reviewedAt: rating === null ? null : new Date() } });
  await recordServiceAudit("project.review_set", { projectId: id, rating });
  return { rating };
}

/** Words that put a Chat entry on this project when its client has several projects. Applies to waiting entries at once. */
export async function setKeywords(id: string, body: Record<string, unknown>) {
  const p = await find(id);
  const keywords = strList(body.keywords, "keywords", { max: 20, each: 80 });
  for (const k of keywords) if (k.length < 2) throw badRequest("keywords need at least 2 characters.");
  const clean = [...new Map(keywords.map((k) => [normalizeName(k), k])).values()];
  await ServiceProject.updateOne({ _id: id }, { $set: { chatKeywords: clean } });
  const assigned = p.clientId ? await autoAssignProjects(p.clientId) : 0;
  await recordServiceAudit("project.keywords_set", { projectId: id, keywords: clean.length, assigned });
  return { keywords: clean, assigned };
}

export async function setInHouse(id: string, body: Record<string, unknown>) {
  await find(id);
  const inHouse = bool(body.inHouse, "inHouse");
  await ServiceProject.updateOne({ _id: id }, { $set: { inHouse } });
  await recordServiceAudit("project.in_house_set", { projectId: id, inHouse });
  return { inHouse };
}

export async function setUpworkProfile(id: string, body: Record<string, unknown>) {
  await find(id);
  const profileId = str(body.profileId, "profileId", { max: 64, optional: true });
  if (profileId && !(await ServiceUpworkProfile.exists({ _id: profileId }))) throw badRequest("unknown profile");
  await ServiceProject.updateOne({ _id: id }, { $set: { upworkProfileId: profileId } });
  await recordServiceAudit("project.profile_set", { projectId: id, profileId });
  return { profileId };
}

// --- bulk ------------------------------------------------------------------------------------------------------------

/** Runs the 45-day On hold / Active rule now (it also runs after every import). */
export async function runActivityRules() {
  const r = await applyActivityRules();
  await recordServiceAudit("project.activity_rules", { held: r.held.length, resumed: r.resumed.length });
  return r;
}

/** One change applied to many projects. A project the change cannot apply to is skipped and reported; the rest are changed. */
export async function bulkEdit(body: Record<string, unknown>) {
  if (!Array.isArray(body.projectIds) || body.projectIds.length < 1 || body.projectIds.length > 500) throw badRequest("projectIds must list 1 to 500 projects.");
  const projectIds = [...new Set((body.projectIds as unknown[]).map((x) => str(x, "projectIds", { max: 64 })!))];
  const a = (body.action ?? {}) as Record<string, unknown>;
  const kind = oneOf(a.kind, "action.kind", ["status", "profile", "people", "manager", "inHouse", "contract"] as const);
  const projects = await ServiceProject.find({ _id: { $in: projectIds } }).lean<ProjectDoc[]>();
  const skipped: Array<{ name: string; reason: string }> = [];
  let changed = 0;
  const now = new Date();

  // Validate the action once.
  const to = kind === "status" ? oneOf(a.to, "action.to", SERVICE_PROJECT_STATUSES) : null;
  const reason = kind === "status" ? str(a.reason, "action.reason", { max: 1000, optional: true }) ?? undefined : undefined;
  const profileId = kind === "profile" ? str(a.profileId, "action.profileId", { max: 64, optional: true }) : null;
  if (kind === "profile" && profileId && !(await ServiceUpworkProfile.exists({ _id: profileId }))) return { changed: 0, skipped: [{ name: "—", reason: "unknown Upwork profile" }] };
  const managerMode = kind === "manager" ? oneOf(a.mode, "action.mode", ["add", "remove"] as const) : null;
  const userId = kind === "manager" ? str(a.userId, "action.userId", { max: 64 })! : null;
  if (kind === "manager" && !(await ServiceUser.exists({ _id: userId, active: true }))) return { changed: 0, skipped: [{ name: "—", reason: "unknown user" }] };
  const inHouseValue = kind === "inHouse" ? bool(a.value, "action.value") : null;
  const peopleRole = kind === "people" ? oneOf(a.role, "action.role", ["BUSINESS_ANALYST", "BUSINESS_DEVELOPER", "EXECUTIVE"] as const) : null;
  const peopleMode = kind === "people" ? oneOf(a.mode, "action.mode", ["replace", "add", "remove"] as const) : null;
  const names = kind === "people" ? personNames(a.names, "action.names", 30) : [];
  const senders = kind === "people" ? await senderList() : [];
  const contractSet: Record<string, unknown> = {};
  if (kind === "contract") {
    if (a.type !== undefined) contractSet.type = oneOf(a.type, "action.type", ["HOURLY", "FIXED"] as const);
    if (a.weeklyLimitMinutes !== undefined) {
      const w = a.weeklyLimitMinutes;
      if (w !== null && (typeof w !== "number" || !Number.isInteger(w) || w < 0 || w > 168 * 60)) throw badRequest("action.weeklyLimitMinutes must be 0 to 10080.");
      contractSet.weeklyLimitMinutes = w || null;
    }
    if (a.trackingMode !== undefined) contractSet.trackingMode = a.trackingMode === null ? null : oneOf(a.trackingMode, "action.trackingMode", ["TIMER", "MANUAL"] as const);
  }

  for (const p of projects) {
    switch (kind) {
      case "status": {
        if (p.status === to) { skipped.push({ name: p.name, reason: "already in that status" }); continue; }
        const check = validateTransition(p.status, to!, reason);
        if (!check.ok) { skipped.push({ name: p.name, reason: check.error }); continue; }
        await ServiceProject.updateOne({ _id: p._id }, { $set: { status: to }, $push: { history: { fromStatus: p.status, toStatus: to, reason: reason ?? "Bulk edit", at: now } } });
        break;
      }
      case "profile":
        await ServiceProject.updateOne({ _id: p._id }, { $set: { upworkProfileId: profileId } });
        break;
      case "inHouse":
        await ServiceProject.updateOne({ _id: p._id }, { $set: { inHouse: inHouseValue } });
        break;
      case "manager":
        if (managerMode === "add") {
          if (!p.assignments.some((x) => x.userId === userId && x.role === "MANAGER")) await ServiceProject.updateOne({ _id: p._id }, { $push: { assignments: { userId, role: "MANAGER" } } });
        } else await ServiceProject.updateOne({ _id: p._id }, { $pull: { assignments: { userId, role: "MANAGER" } } });
        break;
      case "people": {
        const keys = new Set(names.map(normalizeName));
        let list = p.people;
        if (peopleMode === "replace") list = list.filter((x) => x.role !== peopleRole);
        if (peopleMode === "remove") list = list.filter((x) => x.role !== peopleRole || !keys.has(normalizeName(x.name)));
        if (peopleMode !== "remove") {
          const have = new Set(list.filter((x) => x.role === peopleRole).map((x) => x.name));
          for (const name of new Map(names.map((n) => [normalizeName(n), n])).values()) if (!have.has(name)) list = [...list, { role: peopleRole!, name, senderId: matchSender(name, senders) }];
        }
        await ServiceProject.updateOne({ _id: p._id }, { $set: { people: list } });
        break;
      }
      case "contract": {
        if (!Object.keys(contractSet).length) { skipped.push({ name: p.name, reason: "nothing to change" }); continue; }
        if (p.contract) await ServiceProject.updateOne({ _id: p._id }, { $set: Object.fromEntries(Object.entries(contractSet).map(([k, v]) => [`contract.${k}`, v])) });
        else if (p.clientId) await ServiceProject.updateOne({ _id: p._id }, { $set: { contract: { type: "HOURLY", status: "ACTIVE", weeklyLimitMinutes: null, hourlyRateCents: null, fixedPriceCents: null, trackingMode: null, externalRef: null, startDate: null, endDate: null, ...contractSet } } });
        else { skipped.push({ name: p.name, reason: "project has no client, so no contract" }); continue; }
        break;
      }
    }
    changed++;
  }
  for (const id of projectIds) if (!projects.some((p) => p._id === id)) skipped.push({ name: id, reason: "not found" });
  // A new profile or new people can decide where waiting entries of multi-project clients belong.
  if (kind === "profile" || kind === "people") await autoAssignProjects();
  await recordServiceAudit("project.bulk_edit", { action: kind, ...(kind === "status" ? { to } : {}), selected: projectIds.length, changed, skipped: skipped.length });
  return { changed, skipped };
}
