import mongoose from "mongoose";
import { MAX_DESCRIPTION, MAX_NAME, MAX_PROJECT_MEMBERS, MAX_TEXT, PROJECT_STATUSES, type ProjectStatus } from "./constants";

// Untrusted-payload normalizers for the team and project routes. Each returns
// either the cleaned value or an error message, so a route can answer 400
// with a reason.
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(raw: unknown, label: string, max: number, required: boolean): Result<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (required && !value) return { ok: false, error: `${label} is required.` };
  if (value.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  return { ok: true, value };
}

export function parseTeamMemberInput(body: Record<string, unknown>): Result<{ name: string; email: string | null; designation: string }> {
  const name = text(body.name, "Name", MAX_NAME, true);
  if (!name.ok) return name;
  const designation = text(body.designation, "Designation", MAX_TEXT, true);
  if (!designation.ok) return designation;
  const email = text(body.email, "Email", MAX_NAME * 2, false);
  if (!email.ok) return email;
  if (email.value && !EMAIL_RE.test(email.value)) return { ok: false, error: "Email is not a valid address." };
  return { ok: true, value: { name: name.value, email: email.value ? email.value.toLowerCase() : null, designation: designation.value } };
}

/** "YYYY-MM-DD" (or empty -> null) to a UTC-midnight Date, so a date picked in any time zone round-trips unchanged. */
export function parseDateOnly(raw: unknown, label: string): Result<Date | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string" || !DATE_RE.test(raw)) return { ok: false, error: `${label} must be a YYYY-MM-DD date.` };
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return { ok: false, error: `${label} is not a real date.` };
  return { ok: true, value: date };
}

export function parseStatus(raw: unknown): Result<ProjectStatus> {
  return PROJECT_STATUSES.includes(raw as ProjectStatus) ? { ok: true, value: raw as ProjectStatus } : { ok: false, error: "Status is not valid." };
}

/** Drops malformed entries and duplicate members (first wins); an empty role becomes null. */
export function parseProjectMembers(raw: unknown): Result<{ memberId: string; role: string | null }[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "members must be an array." };
  const seen = new Set<string>();
  const members: { memberId: string; role: string | null }[] = [];
  for (const entry of raw) {
    const memberId = String((entry as { memberId?: unknown })?.memberId ?? "");
    if (!mongoose.Types.ObjectId.isValid(memberId) || seen.has(memberId)) continue;
    const role = text((entry as { role?: unknown })?.role, "Role", MAX_TEXT, false);
    if (!role.ok) return role;
    seen.add(memberId);
    members.push({ memberId, role: role.value || null });
  }
  if (members.length > MAX_PROJECT_MEMBERS) return { ok: false, error: `A project can have at most ${MAX_PROJECT_MEMBERS} members.` };
  return { ok: true, value: members };
}

type ProjectFields = { name?: string; description?: string; status?: ProjectStatus; startDate?: Date | null; dueDate?: Date | null };

/** `partial` (PATCH) validates only the keys present; otherwise (POST) a name is required. */
export function parseProjectFields(body: Record<string, unknown>, partial: boolean): Result<ProjectFields> {
  const out: ProjectFields = {};
  if (!partial || "name" in body) {
    const name = text(body.name, "Name", MAX_NAME, true);
    if (!name.ok) return name;
    out.name = name.value;
  }
  if ("description" in body) {
    const description = text(body.description, "Description", MAX_DESCRIPTION, false);
    if (!description.ok) return description;
    out.description = description.value;
  }
  if ("status" in body) {
    const status = parseStatus(body.status);
    if (!status.ok) return status;
    out.status = status.value;
  }
  for (const key of ["startDate", "dueDate"] as const) {
    if (!(key in body)) continue;
    const date = parseDateOnly(body[key], key === "startDate" ? "Start date" : "Due date");
    if (!date.ok) return date;
    out[key] = date.value;
  }
  return { ok: true, value: out };
}

/** Cross-field check, run against the final values (a PATCH may change only one of the two dates). */
export function datesInOrder(startDate: Date | null | undefined, dueDate: Date | null | undefined): boolean {
  return !startDate || !dueDate || dueDate >= startDate;
}
