import "server-only";
// Departments follow the project manager (ported from the Upwork app's departments.controller.ts), plus a small directory of
// service users (the managers). No logins: ServiceUser is just a list of people.
import { randomUUID } from "node:crypto";
import { badRequest, bool, notFound, ServiceError, str, strList } from "./http";
import { recordServiceAudit } from "../audit/record";
import { loadProjectDepartments } from "../reports/project-departments";
import { ServiceDepartment } from "@/models/service-department";
import { ServiceProject } from "@/models/service-project";
import { ServiceUser } from "@/models/service-user";

const conflict = (m: string) => new ServiceError(409, m);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function deptName(v: unknown) {
  const n = str(v, "name", { max: 80 })!;
  if (n.length < 2) throw badRequest("name must be at least 2 characters.");
  return n;
}

async function assertName(n: string, ownId?: string) {
  const clash = await ServiceDepartment.findOne({ name: new RegExp(`^${escape(n)}$`, "i"), ...(ownId ? { _id: { $ne: ownId } } : {}) }).lean();
  if (clash) throw conflict("A department with that name exists.");
}

async function assertManager(userId: string | null | undefined, ownId?: string) {
  if (!userId) return;
  if (!(await ServiceUser.exists({ _id: userId, active: true }))) throw badRequest("Unknown person.");
  const taken = await ServiceDepartment.findOne({ managerUserId: userId, ...(ownId ? { _id: { $ne: ownId } } : {}) }).lean<{ name: string } | null>();
  if (taken) throw conflict(`That person already leads "${taken.name}".`);
}

const userIdOf = (v: unknown, field = "managerUserId") => (v === null || v === "" ? null : str(v, field, { max: 64 }));

export async function listDepartments() {
  const [{ departments, deptOf, projects }, users] = await Promise.all([
    loadProjectDepartments(),
    ServiceUser.find().sort({ displayName: 1 }).select("displayName email kind active").lean<Array<{ _id: string; displayName: string; email: string | null; kind: string; active: boolean }>>(),
  ]);
  const name = new Map(users.map((u) => [u._id, u.displayName]));
  return {
    users: users.filter((u) => u.active).map((u) => ({ id: u._id, displayName: u.displayName })),
    directory: users.map((u) => ({ id: u._id, displayName: u.displayName, email: u.email, kind: u.kind, active: u.active })),
    departments: departments.map((d) => ({
      id: d._id, name: d.name, isDefault: d.isDefault, manager: d.managerUserId ? { id: d.managerUserId, displayName: d.managerName ?? "Unknown" } : null,
      projects: projects.filter((p) => deptOf.get(p._id) === d._id).map((p) => ({ id: p._id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
    })),
    projects: projects
      .map((p) => ({
        id: p._id, name: p.name,
        managers: p.assignments.filter((a) => a.role === "MANAGER").map((a) => ({ id: a.userId, displayName: name.get(a.userId) ?? "Unknown" })),
        departmentId: deptOf.get(p._id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export type DepartmentList = Awaited<ReturnType<typeof listDepartments>>;

export async function createDepartment(body: Record<string, unknown>) {
  const name = deptName(body.name);
  const isDefault = body.isDefault === undefined ? false : bool(body.isDefault, "isDefault");
  const managerUserId = body.managerUserId === undefined ? null : userIdOf(body.managerUserId);
  await assertName(name);
  if (isDefault) {
    if (managerUserId) throw badRequest("The default department has no manager.");
    if (await ServiceDepartment.exists({ isDefault: true })) throw conflict("There is already a default department.");
  }
  await assertManager(managerUserId);
  const row = await ServiceDepartment.create({ _id: randomUUID(), name, isDefault, managerUserId });
  await recordServiceAudit("department.create", { departmentId: row._id, name, isDefault });
  return { id: row._id as string };
}

export async function updateDepartment(id: string, body: Record<string, unknown>) {
  const row = await ServiceDepartment.findById(id).lean<{ _id: string; isDefault: boolean } | null>();
  if (!row) throw notFound("Department not found.");
  const set: Record<string, unknown> = {};
  if (body.name !== undefined) {
    set.name = deptName(body.name);
    await assertName(set.name as string, row._id);
  }
  if (body.managerUserId !== undefined) {
    const m = userIdOf(body.managerUserId);
    if (m && row.isDefault) throw badRequest("The default department has no manager.");
    await assertManager(m, row._id);
    set.managerUserId = m;
  }
  await ServiceDepartment.updateOne({ _id: row._id }, { $set: set });
  await recordServiceAudit("department.update", { departmentId: row._id, renamed: "name" in set, managerChanged: "managerUserId" in set });
  return { id: row._id };
}

export async function makeDefault(id: string) {
  const row = await ServiceDepartment.findById(id).lean<{ _id: string } | null>();
  if (!row) throw notFound("Department not found.");
  await ServiceDepartment.updateMany({ isDefault: true }, { $set: { isDefault: false } });
  await ServiceDepartment.updateOne({ _id: row._id }, { $set: { isDefault: true, managerUserId: null } });
  await recordServiceAudit("department.set_default", { departmentId: row._id });
  return { id: row._id };
}

/** Removing a department sends its projects to the default one; hours are untouched. The default cannot be removed. */
export async function deleteDepartment(id: string) {
  const row = await ServiceDepartment.findById(id).lean<{ _id: string; name: string; isDefault: boolean } | null>();
  if (!row) throw notFound("Department not found.");
  if (row.isDefault) throw conflict("The default department cannot be removed; make another one the default first.");
  await ServiceDepartment.deleteOne({ _id: row._id });
  await recordServiceAudit("department.delete", { departmentId: row._id, name: row.name });
  return { deleted: true };
}

/** Bulk: add or remove one person as manager of many projects. This is how projects get into a department. */
export async function setProjectManagers(body: Record<string, unknown>) {
  const projectIds = strList(body.projectIds, "projectIds", { max: 300, each: 64 });
  if (projectIds.length === 0) throw badRequest("Pick at least one project.");
  const userId = str(body.userId, "userId", { max: 64 })!;
  const action = body.action === "add" || body.action === "remove" ? body.action : null;
  if (!action) throw badRequest("action must be add or remove.");
  if (!(await ServiceUser.exists({ _id: userId, active: true }))) throw badRequest("Unknown person.");
  const found = await ServiceProject.countDocuments({ _id: { $in: projectIds } });
  if (found !== projectIds.length) throw badRequest("Unknown project.");
  const r = action === "add"
    ? await ServiceProject.updateMany({ _id: { $in: projectIds }, assignments: { $not: { $elemMatch: { userId, role: "MANAGER" } } } }, { $push: { assignments: { userId, role: "MANAGER" } } })
    : await ServiceProject.updateMany({ _id: { $in: projectIds }, assignments: { $elemMatch: { userId, role: "MANAGER" } } }, { $pull: { assignments: { userId, role: "MANAGER" } } });
  await recordServiceAudit("project.managers_bulk", { userId, action, projects: projectIds.length, changed: r.modifiedCount });
  return { changed: r.modifiedCount };
}

// --- service users (managers directory) -------------------------------------------------------------------------------------

export async function listUsers() {
  const users = await ServiceUser.find().sort({ displayName: 1 }).lean<Array<{ _id: string; displayName: string; email: string | null; kind: string; active: boolean }>>();
  return users.map((u) => ({ id: u._id, displayName: u.displayName, email: u.email, kind: u.kind, active: u.active }));
}

function email(v: unknown) {
  const e = str(v, "email", { max: 200, optional: true });
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw badRequest("email is not valid.");
  return e?.toLowerCase() ?? null;
}

export async function createUser(body: Record<string, unknown>) {
  const displayName = str(body.displayName, "displayName", { max: 80 })!;
  const row = await ServiceUser.create({ _id: randomUUID(), displayName, email: email(body.email), kind: body.kind === "EMPLOYEE" ? "EMPLOYEE" : "MANAGEMENT", active: true });
  await recordServiceAudit("service_user.create", { userId: row._id });
  return { id: row._id as string };
}

export async function updateUser(id: string, body: Record<string, unknown>) {
  const row = await ServiceUser.findById(id).lean<{ _id: string } | null>();
  if (!row) throw notFound("Person not found.");
  const set: Record<string, unknown> = {};
  if (body.displayName !== undefined) set.displayName = str(body.displayName, "displayName", { max: 80 });
  if (body.email !== undefined) set.email = email(body.email);
  if (body.active !== undefined) {
    set.active = bool(body.active, "active");
    // A person who leaves stops leading a department; their past project assignments stay as history.
    if (set.active === false) await ServiceDepartment.updateMany({ managerUserId: row._id }, { $set: { managerUserId: null } });
  }
  await ServiceUser.updateOne({ _id: row._id }, { $set: set });
  await recordServiceAudit("service_user.update", { userId: row._id, fields: Object.keys(set) });
  return { id: row._id };
}
