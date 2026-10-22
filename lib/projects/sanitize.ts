import mongoose from "mongoose";
import {
  MAX_DESCRIPTION,
  MAX_DURATION_DAYS,
  MAX_HOURS_PER_ENTRY,
  MAX_NAME,
  MAX_NOTE,
  MAX_PROJECT_MEMBERS,
  MAX_TEXT,
  PORTALS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Portal,
  type ProjectStatus,
  type ProjectType,
} from "./constants";

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

/** Blank/null -> null (no portal yet); otherwise one of PORTALS. */
export function parsePortal(raw: unknown): Result<Portal | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  return PORTALS.includes(raw as Portal) ? { ok: true, value: raw as Portal } : { ok: false, error: "Portal is not valid." };
}

/** A missing type means Theme Design & Development, matching rows saved before types existed. */
export function parseProjectType(raw: unknown): Result<ProjectType> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "theme_development" };
  return PROJECT_TYPES.includes(raw as ProjectType) ? { ok: true, value: raw as ProjectType } : { ok: false, error: "Project type is not valid." };
}

export function parseTimeEntryInput(body: Record<string, unknown>): Result<{ memberId: string; date: Date; hours: number; note: string }> {
  const memberId = String(body.memberId ?? "");
  if (!mongoose.Types.ObjectId.isValid(memberId)) return { ok: false, error: "Choose a team member." };
  const date = parseDateOnly(body.date, "Date");
  if (!date.ok) return date;
  if (!date.value) return { ok: false, error: "Date is required." };
  const hours = typeof body.hours === "number" ? body.hours : Number(body.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS_PER_ENTRY) {
    return { ok: false, error: `Hours must be more than 0 and at most ${MAX_HOURS_PER_ENTRY}.` };
  }
  const note = text(body.note, "Note", MAX_NOTE, false);
  if (!note.ok) return note;
  return { ok: true, value: { memberId, date: date.value, hours: Math.round(hours * 100) / 100, note: note.value } };
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

/** Blank/null -> null (not known); otherwise a number of days from 0 up to MAX_DURATION_DAYS, kept to 2 decimals. */
export function parseDays(raw: unknown, label: string): Result<number | null> {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const days = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(days) || days < 0 || days > MAX_DURATION_DAYS) {
    return { ok: false, error: `${label} must be a number of days from 0 to ${MAX_DURATION_DAYS}.` };
  }
  return { ok: true, value: Math.round(days * 100) / 100 };
}

type ProjectFields = { name?: string; portal?: Portal | null; description?: string; status?: ProjectStatus; designDays?: number | null; developmentDays?: number | null };

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
  if ("portal" in body) {
    const portal = parsePortal(body.portal);
    if (!portal.ok) return portal;
    out.portal = portal.value;
  }
  if ("status" in body) {
    const status = parseStatus(body.status);
    if (!status.ok) return status;
    out.status = status.value;
  }
  for (const key of ["designDays", "developmentDays"] as const) {
    if (!(key in body)) continue;
    const days = parseDays(body[key], key === "designDays" ? "Design duration" : "Development duration");
    if (!days.ok) return days;
    out[key] = days.value;
  }
  return { ok: true, value: out };
}
