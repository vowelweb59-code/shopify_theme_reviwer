import "server-only";
import { randomUUID } from "node:crypto";
import { badRequest, day, isoDay, notFound, str } from "./http";
import { recordServiceAudit } from "../audit/record";
import { DM_LEFT, dmMatch } from "../dm-members";
import { MANUAL_SENDER_ID, MANUAL_SOURCE, manualMinutes } from "../hours/manual-hours";
import { istDate } from "../import/text";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Manual hours on a project (see lib/service/hours/manual-hours.ts): add, allocate to a team member (or take back), delete.

export interface ManualHoursRow {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  /** The team member's key (as in DM_MEMBERS), or null while the hours belong to nobody. */
  member: string | null;
  memberName: string | null;
}
export interface ManualMember {
  key: string;
  name: string;
}

type Sender = { externalId: string; displayName: string };

/** The team members hours can be allocated to: Digital Marketing people who have not left, each with one Chat sender. */
async function membersWithSenders(): Promise<Array<ManualMember & { senderExternalId: string }>> {
  const rows = await ServiceChatSender.find().select("externalId displayName").sort({ displayName: 1 }).lean<Sender[]>();
  const byKey = new Map<string, ManualMember & { senderExternalId: string }>();
  for (const s of rows) {
    const key = dmMatch(s.displayName);
    if (!key || DM_LEFT.includes(key) || byKey.has(key)) continue;
    byKey.set(key, { key, name: s.displayName, senderExternalId: s.externalId });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function manualHoursMembers(): Promise<ManualMember[]> {
  return (await membersWithSenders()).map(({ key, name }) => ({ key, name }));
}

/** The sender to store for a member key; null/"" = nobody (the pseudo sender). */
async function senderFor(member: unknown): Promise<string> {
  if (member === undefined || member === null || member === "") return MANUAL_SENDER_ID;
  const key = str(member, "member", { max: 80 })!;
  const found = (await membersWithSenders()).find((m) => m.key === key);
  if (!found) throw badRequest("That team member cannot be given manual hours.");
  return found.senderExternalId;
}

async function project(id: string) {
  const p = await ServiceProject.findById(id).select("name clientId").lean<{ _id: string; name: string; clientId: string | null } | null>();
  if (!p) throw notFound("Project not found.");
  return p;
}

export async function listManualHours(projectId: string): Promise<ManualHoursRow[]> {
  const rows = await ServiceTimeEntry.find({ projectId, source: MANUAL_SOURCE })
    .sort({ entryDate: -1, createdAt: -1 })
    .select("entryDate minutes memo senderExternalId")
    .lean<Array<{ _id: string; entryDate: Date; minutes: number; memo: string | null; senderExternalId: string }>>();
  const senders = new Map((await ServiceChatSender.find().select("externalId displayName").lean<Sender[]>()).map((s) => [s.externalId, s.displayName]));
  return rows.map((r) => {
    const mine = r.senderExternalId !== MANUAL_SENDER_ID;
    const name = mine ? (senders.get(r.senderExternalId) ?? null) : null;
    return { id: r._id, date: day(r.entryDate)!, minutes: r.minutes, note: r.memo ?? null, member: name ? dmMatch(name) : null, memberName: name };
  });
}

export async function addManualHours(projectId: string, body: Record<string, unknown>) {
  const p = await project(projectId);
  let minutes: number;
  try {
    minutes = manualMinutes(body.hours, body.minutes);
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : "Check the hours.");
  }
  const date = isoDay(body.date, "date") ?? new Date(`${istDate(new Date())}T00:00:00Z`);
  if (date.toISOString().slice(0, 10) > istDate(new Date())) throw badRequest("The date cannot be in the future.");
  const note = str(body.note, "note", { max: 500, optional: true });
  const senderExternalId = await senderFor(body.member);
  const id = randomUUID();
  await ServiceTimeEntry.create({
    _id: id,
    senderExternalId,
    clientId: p.clientId,
    projectId,
    entryDate: date,
    minutes,
    source: MANUAL_SOURCE,
    state: "PARSED",
    memo: note,
    notes: ["MANUAL_HOURS_ADDED"],
    parserVersion: "manual",
    sourceMessageId: `manual:${id}`,
  });
  await recordServiceAudit("hours.manual_add", {
    projectId,
    entryId: id,
    minutes,
    date: date.toISOString().slice(0, 10),
    allocated: senderExternalId !== MANUAL_SENDER_ID,
  });
  return listManualHours(projectId);
}

async function manualEntry(entryId: string) {
  const e = await ServiceTimeEntry.findById(entryId).select("projectId source").lean<{ _id: string; projectId: string | null; source: string } | null>();
  if (!e || e.source !== MANUAL_SOURCE || !e.projectId) throw notFound("Manual hours entry not found.");
  return e as { _id: string; projectId: string; source: string };
}

/** Gives the hours to a team member (`member` = their key), or takes them back to nobody (`member` empty). */
export async function allocateManualHours(entryId: string, body: Record<string, unknown>) {
  const e = await manualEntry(entryId);
  const senderExternalId = await senderFor(body.member);
  await ServiceTimeEntry.updateOne({ _id: entryId }, { $set: { senderExternalId } });
  await recordServiceAudit("hours.manual_allocate", { projectId: e.projectId, entryId, to: senderExternalId === MANUAL_SENDER_ID ? null : senderExternalId });
  return listManualHours(e.projectId);
}

export async function deleteManualHours(entryId: string) {
  const e = await manualEntry(entryId);
  await ServiceTimeEntry.deleteOne({ _id: entryId });
  await recordServiceAudit("hours.manual_delete", { projectId: e.projectId, entryId });
  return listManualHours(e.projectId);
}
