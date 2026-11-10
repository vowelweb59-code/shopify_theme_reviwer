import "server-only";
// Review queue, client list upkeep, Upwork profiles and Chat senders (ported from the Upwork app's review.controller.ts,
// clients.controller.ts and profiles.controller.ts). One shared login here, so anyone signed in may review.
// "Contract" in the old app is the project here (one contract per project); assigning an entry sets its projectId.
import { randomUUID } from "node:crypto";
import { ServiceError, badRequest, bool, day, int, notFound, str, strList } from "./http";
import { recordServiceAudit } from "../audit/record";
import { autoAssignProjects } from "../hours/auto-assign";
import { suggestClientName } from "../import/client-field";
import { matchProfile } from "../import/profile-match";
import { rematchClients } from "../import/rematch";
import { normalizeName } from "../import/text";
import { MAX_PLAUSIBLE_MINUTES } from "../import/timer-intervals";
import { ServiceChatMessage, ServiceChatSender } from "@/models/service-chat";
import { ServiceClient } from "@/models/service-client";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkAccount, ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceUser } from "@/models/service-user";

// ---------------------------------------------------------------------------------------------------------------------
// Shapes (shared with the pages)

export type ReviewEntry = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  clientRaw: string | null;
  suggestedClient: string | null;
  entryDate: string;
  source: "TIMER_CALCULATED" | "MANUAL_REPORT";
  minutes: number;
  state: "PARSED" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  flags: string[];
  notes: string[];
  memo: string | null;
  isLate: boolean;
  profile: string | null;
  reportedOnTimerMinutes: number | null;
  reconciliation: string | null;
  sender: string;
  postedAt: string;
  client: { id: string; name: string } | null;
  messageText: string;
  openTimer: boolean;
  orphanOff: boolean;
};

export type ReviewProject = { id: string; projectName: string; clientId: string | null };

export type ReviewList = {
  total: number;
  entries: ReviewEntry[];
  clients: Array<{ id: string; name: string }>;
  projects: ReviewProject[];
};

export type SenderList = {
  users: Array<{ id: string; displayName: string }>;
  senders: Array<{ id: string; displayName: string; user: { id: string; displayName: string } | null; matchedBy: "NAME" | "MANUAL" | null; entries: number; minutes: number }>;
};

export type ProfileList = {
  accounts: Array<{ id: string; login: string }>;
  profiles: Array<{ id: string; name: string; aliases: string[]; account: { id: string; login: string } | null; entries: number; minutes: number }>;
  unmatched: Array<{ name: string; entries: number; minutes: number }>;
};

export type ClientList = {
  clients: Array<{ id: string; name: string; aliases: string[]; inHouse: boolean; splitUnclear: boolean; entries: number; minutes: number }>;
  unmatched: Array<{ raw: string; suggested: string | null; entries: number; minutes: number }>;
};

type EntryDoc = {
  _id: string;
  clientId: string | null;
  projectId: string | null;
  clientRaw: string | null;
  entryDate: Date;
  source: ReviewEntry["source"];
  minutes: number;
  state: ReviewEntry["state"];
  flags: string[];
  notes: string[];
  memo: string | null;
  isLate: boolean;
  profile: string | null;
  reportedOnTimerMinutes: number | null;
  reconciliation: string | null;
  sourceMessageId: string;
  allocations: Array<{ projectId: string; minutes: number }>;
};

/** Live projects (a contract that has not ended), as the review pickers need them. */
async function liveProjects(): Promise<ReviewProject[]> {
  const rows = await ServiceProject.find({ contract: { $ne: null }, "contract.status": { $ne: "ENDED" } }).select("name clientId").sort({ name: 1 }).lean<Array<{ _id: string; name: string; clientId: string | null }>>();
  return rows.map((p) => ({ id: p._id, projectName: p.name, clientId: p.clientId }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Review queue

/**
 * Waiting for a person: only entries the importer flagged. Clean entries (late ones included) go straight to the dashboard.
 * view=unassigned: entries of a client with several live projects that nobody placed yet.
 */
export async function listReview(opts: { flag?: string | null; view?: string | null } = {}): Promise<ReviewList> {
  const projects = await liveProjects();
  const perClient = new Map<string, number>();
  for (const p of projects) if (p.clientId) perClient.set(p.clientId, (perClient.get(p.clientId) ?? 0) + 1);
  const sharedClients = [...perClient].filter(([, n]) => n > 1).map(([k]) => k);
  const where: Record<string, unknown> =
    opts.view === "unassigned"
      ? { state: { $ne: "REJECTED" }, projectId: null, allocations: { $size: 0 }, clientId: { $in: sharedClients } }
      : { state: "NEEDS_REVIEW", ...(opts.flag ? { flags: opts.flag } : {}) };
  const [rows, total, clientRows] = await Promise.all([
    ServiceTimeEntry.find(where).sort({ entryDate: -1, createdAt: -1 }).limit(300).lean<EntryDoc[]>(),
    ServiceTimeEntry.countDocuments(where),
    ServiceClient.find().select("name").sort({ name: 1 }).lean<Array<{ _id: string; name: string }>>(),
  ]);
  const messages = new Map(
    (await ServiceChatMessage.find({ _id: { $in: rows.map((r) => r.sourceMessageId) } }).select("senderName postedAt text").lean<Array<{ _id: string; senderName: string; postedAt: Date; text: string }>>()).map((m) => [m._id, m])
  );
  const clientName = new Map(clientRows.map((c) => [c._id, c.name]));
  return {
    total,
    entries: rows.map((e) => {
      const m = messages.get(e.sourceMessageId);
      return {
        id: e._id, clientId: e.clientId, projectId: e.projectId, clientRaw: e.clientRaw, suggestedClient: e.clientId ? null : suggestClientName(e.clientRaw ?? ""),
        entryDate: day(e.entryDate)!, source: e.source, minutes: e.minutes, state: e.state, flags: e.flags, notes: e.notes, memo: e.memo, isLate: e.isLate, profile: e.profile,
        reportedOnTimerMinutes: e.reportedOnTimerMinutes, reconciliation: e.reconciliation,
        sender: m?.senderName ?? "Unknown sender", postedAt: m ? new Date(m.postedAt).toISOString() : "",
        client: e.clientId ? { id: e.clientId, name: clientName.get(e.clientId) ?? "Unknown client" } : null,
        // Evidence for the reviewer: the original Chat text.
        messageText: (m?.text ?? "").slice(0, 1500),
        openTimer: e.flags.includes("OPEN_INTERVAL"), orphanOff: e.flags.includes("ORPHAN_OFF"),
      };
    }),
    clients: clientRows.map((c) => ({ id: c._id, name: c.name })),
    projects,
  };
}

async function pendingEntry(entryId: string): Promise<EntryDoc> {
  const e = await ServiceTimeEntry.findById(entryId).lean<EntryDoc | null>();
  if (!e) throw notFound("Entry not found.");
  if (e.state === "APPROVED" || e.state === "REJECTED") throw badRequest(`This entry is already ${e.state.toLowerCase()}.`);
  return e;
}

export async function approveEntry(entryId: string, body: Record<string, unknown>) {
  const e = await pendingEntry(entryId);
  for (const k of Object.keys(body)) if (!["minutes", "clientId", "projectId"].includes(k)) throw badRequest(`Unknown field: ${k}`);
  const minutes = "minutes" in body ? int(body.minutes, "minutes", { max: MAX_PLAUSIBLE_MINUTES }) : null;
  const clientId = "clientId" in body ? str(body.clientId, "clientId", { optional: true }) : null;
  const projectId = "projectId" in body ? str(body.projectId, "projectId", { optional: true }) : null;
  if (e.flags.includes("OPEN_INTERVAL") || e.flags.includes("ORPHAN_OFF")) throw badRequest("Resolve the timer first: give the missing time, or reject the entry.");
  if (!(e.clientId ?? clientId)) throw badRequest("Choose the client before approving.");
  if (clientId && !(await ServiceClient.exists({ _id: clientId }))) throw badRequest("Unknown client.");
  if (projectId && !(await ServiceProject.exists({ _id: projectId, contract: { $ne: null } }))) throw badRequest("Unknown project.");
  const set: Record<string, unknown> = {
    state: "APPROVED",
    notes: [...e.notes, "APPROVED_BY_REVIEW", ...(minutes !== null && minutes !== e.minutes ? ["MINUTES_CORRECTED"] : [])],
  };
  if (minutes !== null) set.minutes = minutes;
  if (clientId) set.clientId = clientId;
  if (projectId) Object.assign(set, { projectId, allocations: [] });
  await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: set });
  const to = minutes ?? e.minutes;
  await recordServiceAudit("time_entry.approve", { entryId: e._id, from: e.minutes, to, clientChanged: !!clientId });
  return { id: e._id, state: "APPROVED", minutes: to };
}

export async function rejectEntry(entryId: string, body: Record<string, unknown>) {
  const e = await pendingEntry(entryId);
  const reason = str(body.reason, "reason", { max: 500 })!;
  await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { state: "REJECTED", notes: [...e.notes, `REJECTED_BY_REVIEW: ${reason}`] } });
  await recordServiceAudit("time_entry.reject", { entryId: e._id, reason });
  return { id: e._id, state: "REJECTED" };
}

const instant = (v: unknown, field: string): Date | null => {
  if (v === undefined || v === null) return null;
  // Offsets are required: reports are IST.
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) || Number.isNaN(Date.parse(v))) throw badRequest(`${field} must be a date and time with an offset.`);
  return new Date(v);
};

/** Supplies the missing end (open ON) or start (orphan OFF) and approves the resulting interval. */
export async function resolveTimer(entryId: string, body: Record<string, unknown>) {
  const e = await pendingEntry(entryId);
  const endAt = instant(body.endAt, "endAt");
  const startAt = instant(body.startAt, "startAt");
  const open = e.flags.includes("OPEN_INTERVAL");
  const orphan = e.flags.includes("ORPHAN_OFF");
  if (!open && !orphan) throw badRequest("This entry is not an open or unmatched timer.");
  if (open && (!endAt || startAt)) throw badRequest("An open timer needs endAt (the time it was switched off).");
  if (orphan && (!startAt || endAt)) throw badRequest("An unmatched OFF needs startAt (the time it was switched on).");
  const msg = await ServiceChatMessage.findById(e.sourceMessageId).select("postedAt").lean<{ postedAt: Date } | null>();
  if (!msg) throw notFound("The Chat message of this entry is missing.");
  const known = new Date(msg.postedAt); // the ON message for an open timer, the OFF message for an orphan
  const start = open ? known : startAt!;
  const end = open ? endAt! : known;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes <= 0) throw badRequest("The OFF time must be after the ON time.");
  if (minutes > MAX_PLAUSIBLE_MINUTES) throw badRequest("More than 16 hours: split it or reject the entry.");
  const flags = e.flags.filter((f) => f !== "OPEN_INTERVAL" && f !== "ORPHAN_OFF" && f !== "DUPLICATE_ON");
  const state = flags.length ? "NEEDS_REVIEW" : "APPROVED";
  await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { minutes, flags, state, notes: [...e.notes, open ? "OFF_SUPPLIED_BY_REVIEW" : "ON_SUPPLIED_BY_REVIEW"] } });
  await recordServiceAudit("time_entry.resolve_timer", { entryId: e._id, kind: open ? "open" : "orphan", minutes });
  return { id: e._id, state, minutes, flags };
}

/** Puts an entry on a specific project (or back to automatic with null). Works on any entry that is not rejected. */
export async function assignProject(entryId: string, body: Record<string, unknown>) {
  if (!("projectId" in body)) throw badRequest("projectId is required (null for automatic).");
  const projectId = str(body.projectId, "projectId", { optional: true });
  const e = await ServiceTimeEntry.findById(entryId).select("state clientId").lean<{ _id: string; state: string; clientId: string | null } | null>();
  if (!e || e.state === "REJECTED") throw notFound("Entry not found.");
  if (projectId) {
    const p = await ServiceProject.findById(projectId).select("clientId contract").lean<{ clientId: string | null; contract: unknown } | null>();
    if (!p || !p.contract) throw badRequest("Unknown project.");
    if (e.clientId && p.clientId && e.clientId !== p.clientId) throw badRequest("That project belongs to a different client.");
  }
  // A person's choice replaces any automatic split.
  await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { projectId, allocations: [] } });
  await recordServiceAudit("time_entry.assign_project", { entryId: e._id, projectId });
  return { id: e._id, projectId };
}

// ---------------------------------------------------------------------------------------------------------------------
// Chat senders

/** Chat senders and the person each is attributed to. Unmatched senders keep their hours under their own name. */
export async function listSenders(): Promise<SenderList> {
  const [senders, users, totals] = await Promise.all([
    ServiceChatSender.find().select("externalId displayName userId matchedBy").sort({ displayName: 1 }).lean<Array<{ _id: string; externalId: string; displayName: string; userId: string | null; matchedBy: "NAME" | "MANUAL" | null }>>(),
    ServiceUser.find({ active: true }).select("displayName").sort({ displayName: 1 }).lean<Array<{ _id: string; displayName: string }>>(),
    ServiceTimeEntry.aggregate<{ _id: string; entries: number; minutes: number }>([{ $match: { state: { $ne: "REJECTED" } } }, { $group: { _id: "$senderExternalId", entries: { $sum: 1 }, minutes: { $sum: "$minutes" } } }]),
  ]);
  const byExternal = new Map(totals.map((t) => [t._id, t]));
  const userName = new Map(users.map((u) => [u._id, u.displayName]));
  return {
    users: users.map((u) => ({ id: u._id, displayName: u.displayName })),
    senders: senders.map((s) => ({
      id: s._id, displayName: s.displayName, matchedBy: s.matchedBy,
      user: s.userId ? { id: s.userId, displayName: userName.get(s.userId) ?? "Inactive user" } : null,
      entries: byExternal.get(s.externalId)?.entries ?? 0, minutes: byExternal.get(s.externalId)?.minutes ?? 0,
    })),
  };
}

/** Links a sender to a person (or clears the link) and re-attributes everything that sender posted. */
export async function linkSender(senderId: string, body: Record<string, unknown>) {
  if (!("userId" in body)) throw badRequest("userId is required (null to unlink).");
  const userId = str(body.userId, "userId", { optional: true });
  const sender = await ServiceChatSender.findById(senderId).select("externalId").lean<{ _id: string; externalId: string } | null>();
  if (!sender) throw notFound("Sender not found.");
  if (userId && !(await ServiceUser.exists({ _id: userId, active: true }))) throw badRequest("Unknown user.");
  await ServiceChatSender.updateOne({ _id: sender._id }, { $set: { userId, matchedBy: userId ? "MANUAL" : null } });
  await ServiceChatMessage.updateMany({ senderExternalId: sender.externalId }, { $set: { userId } });
  await ServiceTimeEntry.updateMany({ senderExternalId: sender.externalId }, { $set: { userId } });
  await recordServiceAudit("chat_sender.link", { senderId: sender._id, userId });
  return { id: sender._id, userId };
}

// ---------------------------------------------------------------------------------------------------------------------
// Upwork profiles

/** Points every entry at the profile its written name now resolves to. One update per distinct written name. */
async function rematchProfiles() {
  const profiles = (await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((p) => ({ id: p._id, name: p.name, aliases: p.aliases }));
  const written = (await ServiceTimeEntry.distinct("profile", { profile: { $ne: null } })) as string[];
  for (const w of written) {
    const profileId = matchProfile(w, profiles);
    await ServiceTimeEntry.updateMany({ profile: w, profileId: { $ne: profileId } }, { $set: { profileId } });
  }
}

export async function listProfiles(): Promise<ProfileList> {
  const [accounts, profiles, perProfile, loose] = await Promise.all([
    ServiceUpworkAccount.find().select("name").sort({ name: 1 }).lean<Array<{ _id: string; name: string }>>(),
    ServiceUpworkProfile.find().sort({ name: 1 }).lean<Array<{ _id: string; name: string; aliases: string[]; accountId: string | null }>>(),
    ServiceTimeEntry.aggregate<{ _id: string; entries: number; minutes: number }>([{ $match: { profileId: { $ne: null }, state: { $ne: "REJECTED" } } }, { $group: { _id: "$profileId", entries: { $sum: 1 }, minutes: { $sum: "$minutes" } } }]),
    ServiceTimeEntry.aggregate<{ _id: string; entries: number; minutes: number }>([{ $match: { profileId: null, profile: { $ne: null }, state: { $ne: "REJECTED" } } }, { $group: { _id: "$profile", entries: { $sum: 1 }, minutes: { $sum: "$minutes" } } }]),
  ]);
  const totals = new Map(perProfile.map((t) => [t._id, t]));
  const login = new Map(accounts.map((a) => [a._id, a.name]));
  return {
    accounts: accounts.map((a) => ({ id: a._id, login: a.name })),
    profiles: profiles.map((p) => ({
      id: p._id, name: p.name, aliases: p.aliases,
      account: p.accountId && login.has(p.accountId) ? { id: p.accountId, login: login.get(p.accountId)! } : null,
      entries: totals.get(p._id)?.entries ?? 0, minutes: totals.get(p._id)?.minutes ?? 0,
    })),
    // Written names that match no profile yet: add the name as an alias, or create the profile.
    unmatched: loose.map((l) => ({ name: l._id, entries: l.entries, minutes: l.minutes })).sort((a, b) => b.entries - a.entries),
  };
}

async function accountOrNull(v: unknown): Promise<string | null | undefined> {
  if (v === undefined) return undefined;
  const id = str(v, "accountId", { optional: true });
  if (id && !(await ServiceUpworkAccount.exists({ _id: id }))) throw badRequest("Unknown account.");
  return id;
}

export async function createProfile(body: Record<string, unknown>) {
  const name = str(body.name, "name", { max: 100 })!;
  const aliases = body.aliases === undefined ? [] : strList(body.aliases, "aliases", { max: 20, each: 100 });
  const accountId = (await accountOrNull(body.accountId)) ?? null;
  if (await ServiceUpworkProfile.exists({ name })) throw new ServiceError(409, "A profile with that name exists.");
  const id = randomUUID();
  await ServiceUpworkProfile.create({ _id: id, name, aliases, accountId });
  await rematchProfiles();
  await recordServiceAudit("upwork_profile.create", { profileId: id, name });
  return { id };
}

export async function updateProfile(profileId: string, body: Record<string, unknown>) {
  for (const k of Object.keys(body)) if (!["aliases", "accountId"].includes(k)) throw badRequest(`Unknown field: ${k}`);
  if (!(await ServiceUpworkProfile.exists({ _id: profileId }))) throw notFound("Profile not found.");
  const aliases = body.aliases === undefined ? undefined : strList(body.aliases, "aliases", { max: 20, each: 100 });
  const accountId = await accountOrNull(body.accountId);
  await ServiceUpworkProfile.updateOne({ _id: profileId }, { $set: { ...(aliases ? { aliases } : {}), ...(accountId !== undefined ? { accountId } : {}) } });
  await rematchProfiles();
  await recordServiceAudit("upwork_profile.update", { profileId, aliasesChanged: !!aliases, accountChanged: accountId !== undefined });
  return { id: profileId };
}

// ---------------------------------------------------------------------------------------------------------------------
// Clients

/** Every name and alias in use, normalised, mapped to its client: a spelling may belong to one client only. */
async function takenNames(): Promise<Map<string, string>> {
  const all = await ServiceClient.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>();
  const m = new Map<string, string>();
  for (const c of all) for (const n of [c.name, ...c.aliases]) m.set(normalizeName(n), c._id);
  return m;
}

async function assertFree(names: string[], ownId?: string) {
  const taken = await takenNames();
  for (const n of names) {
    const owner = taken.get(normalizeName(n));
    if (owner && owner !== ownId) throw new ServiceError(409, `"${n}" already belongs to another client.`);
  }
}

const clientName = (v: unknown, field = "name") => {
  const n = str(v, field, { max: 120 })!;
  if (n.length < 2) throw badRequest(`${field} must be at least 2 characters.`);
  return n;
};
const clientAliases = (v: unknown) => strList(v, "aliases", { max: 30, each: 120 }).map((a) => clientName(a, "alias"));

export async function listClients(): Promise<ClientList> {
  const [clients, perClient, loose] = await Promise.all([
    ServiceClient.find().sort({ name: 1 }).lean<Array<{ _id: string; name: string; aliases: string[]; inHouse: boolean; splitUnclear: boolean }>>(),
    ServiceTimeEntry.aggregate<{ _id: string; entries: number; minutes: number }>([{ $match: { clientId: { $ne: null }, state: { $ne: "REJECTED" } } }, { $group: { _id: "$clientId", entries: { $sum: 1 }, minutes: { $sum: "$minutes" } } }]),
    ServiceTimeEntry.aggregate<{ _id: string; entries: number; minutes: number }>([
      { $match: { clientId: null, clientRaw: { $ne: null }, state: { $ne: "REJECTED" } } },
      { $group: { _id: "$clientRaw", entries: { $sum: 1 }, minutes: { $sum: "$minutes" } } },
      { $sort: { entries: -1 } },
      { $limit: 300 },
    ]),
  ]);
  const totals = new Map(perClient.map((t) => [t._id, t]));
  return {
    clients: clients.map((c) => ({ id: c._id, name: c.name, aliases: c.aliases, inHouse: c.inHouse, splitUnclear: c.splitUnclear, entries: totals.get(c._id)?.entries ?? 0, minutes: totals.get(c._id)?.minutes ?? 0 })),
    unmatched: loose.map((l) => ({ raw: l._id, suggested: suggestClientName(l._id), entries: l.entries, minutes: l.minutes })),
  };
}

/** After the client list changes: give loose entries their client, then place entries of multi-project clients. */
async function afterClientChange() {
  const fixed = await rematchClients();
  if (fixed) await autoAssignProjects();
  return fixed;
}

export async function createClient(body: Record<string, unknown>) {
  for (const k of Object.keys(body)) if (!["name", "aliases", "inHouse"].includes(k)) throw badRequest(`Unknown field: ${k}`);
  const name = clientName(body.name);
  const aliases = body.aliases === undefined ? [] : clientAliases(body.aliases);
  const inHouse = body.inHouse === undefined ? false : bool(body.inHouse, "inHouse");
  await assertFree([name, ...aliases]);
  const id = randomUUID();
  await ServiceClient.create({ _id: id, name, aliases, inHouse });
  const fixed = await afterClientChange();
  await recordServiceAudit("client.create", { clientId: id, name, inHouse, entriesFixed: fixed });
  return { id, entriesFixed: fixed };
}

/** Creates every name that is free (skipping the rest), then re-reads the unmatched entries once. */
export async function bulkCreateClients(body: Record<string, unknown>) {
  const names = strList(body.names, "names", { max: 300, each: 120 }).map((n) => clientName(n, "names"));
  if (!names.length) throw badRequest("names must not be empty.");
  const taken = await takenNames();
  const fresh: string[] = [];
  for (const n of names) {
    const k = normalizeName(n);
    if (!taken.has(k)) {
      taken.set(k, "new");
      fresh.push(n);
    }
  }
  if (fresh.length) await ServiceClient.insertMany(fresh.map((n) => ({ _id: randomUUID(), name: n })));
  const fixed = await afterClientChange();
  await recordServiceAudit("client.bulk_create", { created: fresh.length, skipped: names.length - fresh.length, entriesFixed: fixed });
  return { created: fresh.length, skipped: names.length - fresh.length, entriesFixed: fixed };
}

export async function updateClient(clientId: string, body: Record<string, unknown>) {
  for (const k of Object.keys(body)) if (!["name", "aliases", "inHouse", "splitUnclear"].includes(k)) throw badRequest(`Unknown field: ${k}`);
  if (!(await ServiceClient.exists({ _id: clientId }))) throw notFound("Client not found.");
  const name = body.name === undefined ? undefined : clientName(body.name);
  const aliases = body.aliases === undefined ? undefined : clientAliases(body.aliases);
  const inHouse = body.inHouse === undefined ? undefined : bool(body.inHouse, "inHouse");
  const splitUnclear = body.splitUnclear === undefined ? undefined : bool(body.splitUnclear, "splitUnclear");
  if (name === undefined && aliases === undefined && inHouse === undefined && splitUnclear === undefined) throw badRequest("Nothing to change.");
  await assertFree([...(name ? [name] : []), ...(aliases ?? [])], clientId);
  await ServiceClient.updateOne({ _id: clientId }, { $set: { ...(name ? { name } : {}), ...(aliases ? { aliases } : {}), ...(inHouse !== undefined ? { inHouse } : {}), ...(splitUnclear !== undefined ? { splitUnclear } : {}) } });
  if (splitUnclear) await autoAssignProjects(clientId);
  const fixed = await afterClientChange();
  await recordServiceAudit("client.update", { clientId, renamed: !!name, aliasesChanged: !!aliases, inHouse, entriesFixed: fixed });
  return { id: clientId, entriesFixed: fixed };
}
