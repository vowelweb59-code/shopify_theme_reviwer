// Writes an ImportPlan to MongoDB. Idempotent: running the same month twice changes nothing, and an edited message (newer
// text) replaces its own entries. Entries a person approved or rejected are never overwritten.
import { randomUUID } from "node:crypto";
import { autoAssignProjects } from "../hours/auto-assign";
import { applyActivityRules } from "../projects/activity-rules";
import { syncReporters } from "../projects/reporters";
import { matchProfile } from "./profile-match";
import { matchSenderToUser } from "./sender-match";
import { AUTO_IGNORED, PARSER_VERSION, type ImportPlan, type PlannedEntry, type SpaceInput } from "./plan";
import { ServiceChatMessage, ServiceChatSender, ServiceChatSpace, ServiceSyncCheckpoint } from "@/models/service-chat";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";
import { ServiceUser } from "@/models/service-user";

export interface PersistResult {
  messages: number;
  entriesCreated: number;
  entriesUpdated: number;
  entriesKeptAsReviewed: number;
  entriesRemoved: number;
}

type StoredEntry = { _id: string; sourceMessageId: string; source: string; ordinal: number; state: string; notes: string[] } & Record<string, unknown>;

// APPROVED, or REJECTED by a person. Automatic rejections carry a DUPLICATE_POST or AUTO_IGNORED note and are re-derived.
export const humanDecided = (e: { state: string; notes: string[] }) =>
  e.state === "APPROVED" || (e.state === "REJECTED" && !e.notes.includes("DUPLICATE_POST") && !e.notes.includes(AUTO_IGNORED));

/** True when every field the import writes already holds the planned value (so the row needs no update). */
function sameEntry(stored: Record<string, unknown>, data: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(data)) {
    const cur = stored[k];
    if (Array.isArray(v)) {
      if (!Array.isArray(cur) || cur.length !== v.length || cur.some((x, i) => x !== v[i])) return false;
    } else if (v instanceof Date) {
      if (!(cur instanceof Date) || cur.getTime() !== v.getTime()) return false;
    } else if ((cur ?? null) !== (v ?? null)) return false;
  }
  return true;
}

const CHUNK = 1000;
async function bulk(ops: Parameters<typeof ServiceTimeEntry.bulkWrite>[0], model: { bulkWrite: typeof ServiceTimeEntry.bulkWrite }) {
  for (let i = 0; i < ops.length; i += CHUNK) await model.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
}

export async function persistPlan(plan: ImportPlan, spaces: readonly SpaceInput[], opts: { followUps?: boolean } = {}): Promise<PersistResult> {
  const out: PersistResult = { messages: 0, entriesCreated: 0, entriesUpdated: 0, entriesKeptAsReviewed: 0, entriesRemoved: 0 };

  const spaceId = new Map<string, string>();
  for (const s of spaces) {
    const row = await ServiceChatSpace.findOneAndUpdate(
      { externalId: s.externalId },
      { $set: { name: s.name }, $setOnInsert: { _id: randomUUID(), type: s.type, clientId: s.type === "CLIENT_PROJECT" ? s.clientId ?? null : null } },
      { upsert: true, returnDocument: "after" }
    ).lean<{ _id: string }>();
    spaceId.set(s.externalId, row!._id);
  }

  // Senders: remember each one; match unmatched ones to a ServiceUser by exact name. A hand-made link is never overwritten.
  const users = (await ServiceUser.find().select("displayName active").lean<Array<{ _id: string; displayName: string; active: boolean }>>()).map((u) => ({ id: u._id, displayName: u.displayName, active: u.active }));
  const senderUser = new Map<string, string | null>();
  const known = new Map(
    (await ServiceChatSender.find({ externalId: { $in: [...new Set(plan.messages.map((m) => m.senderExternalId))] } }).lean<Array<{ externalId: string; displayName: string; userId: string | null }>>()).map((r) => [r.externalId, r])
  );
  for (const m of plan.messages) {
    if (senderUser.has(m.senderExternalId)) continue;
    const existing = known.get(m.senderExternalId);
    if (existing?.userId) {
      senderUser.set(m.senderExternalId, existing.userId);
      continue;
    }
    const matched = matchSenderToUser(m.senderName, users);
    if (!existing || existing.displayName !== m.senderName || existing.userId !== matched) {
      await ServiceChatSender.updateOne(
        { externalId: m.senderExternalId },
        { $set: { displayName: m.senderName, userId: matched, matchedBy: matched ? "NAME" : null }, $setOnInsert: { _id: randomUUID() } },
        { upsert: true }
      );
    }
    senderUser.set(m.senderExternalId, matched);
  }

  const profiles = (await ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>()).map((p) => ({ id: p._id, name: p.name, aliases: p.aliases }));

  // Messages
  const key = (space: string, id: string) => `${space} ${id}`;
  const messageId = new Map<string, string>();
  const stored = new Map<string, { _id: string; senderExternalId: string; senderName: string; postedAt: Date; text: string; kind: string; parserVersion: string; userId: string | null }>();
  const sids = [...spaceId.values()];
  const extIds = plan.messages.map((m) => m.externalId);
  for (let i = 0; i < extIds.length; i += CHUNK) {
    for (const r of await ServiceChatMessage.find({ spaceId: { $in: sids }, externalId: { $in: extIds.slice(i, i + CHUNK) } }).lean<Array<{ _id: string; spaceId: string; externalId: string; senderExternalId: string; senderName: string; postedAt: Date; text: string; kind: string; parserVersion: string; userId: string | null }>>()) {
      stored.set(`${r.spaceId} ${r.externalId}`, r);
    }
  }
  const messageOps: Parameters<typeof ServiceChatMessage.bulkWrite>[0] = [];
  for (const m of plan.messages) {
    const sid = spaceId.get(m.spaceExternalId)!;
    const data = { senderExternalId: m.senderExternalId, senderName: m.senderName, postedAt: new Date(m.postedAt), text: m.text, kind: m.kind, parserVersion: PARSER_VERSION, userId: senderUser.get(m.senderExternalId) ?? null };
    const s = stored.get(`${sid} ${m.externalId}`);
    if (!s) {
      const id = randomUUID();
      messageOps.push({ insertOne: { document: { _id: id, spaceId: sid, externalId: m.externalId, ...data } } });
      messageId.set(key(m.spaceExternalId, m.externalId), id);
    } else {
      messageId.set(key(m.spaceExternalId, m.externalId), s._id);
      const same = s.senderExternalId === data.senderExternalId && s.senderName === data.senderName && s.text === data.text && s.kind === data.kind && s.parserVersion === data.parserVersion && s.userId === data.userId && new Date(s.postedAt).getTime() === data.postedAt.getTime();
      if (!same) messageOps.push({ updateOne: { filter: { _id: s._id }, update: { $set: data } } });
    }
    out.messages++;
  }
  await bulk(messageOps, ServiceChatMessage);

  // Entries
  const fields = (e: PlannedEntry) => ({
    userId: senderUser.get(e.senderExternalId) ?? null, senderExternalId: e.senderExternalId, clientId: e.clientId, clientRaw: e.clientRaw, profile: e.profile, profileId: matchProfile(e.profile, profiles),
    entryDate: new Date(`${e.entryDate}T00:00:00Z`), minutes: e.minutes, state: e.state, flags: e.flags, notes: e.notes, memo: e.memo,
    reportedOnTimerMinutes: e.reportedOnTimerMinutes, reconciliation: e.reconciliation, isLate: e.isLate, parserVersion: PARSER_VERSION,
    startMessageId: e.startMessageExternalId ? messageId.get(key(e.spaceExternalId, e.startMessageExternalId)) ?? null : null,
  });
  const msgIds = [...messageId.values()];
  const storedEntries: StoredEntry[] = [];
  for (let i = 0; i < msgIds.length; i += CHUNK) storedEntries.push(...(await ServiceTimeEntry.find({ sourceMessageId: { $in: msgIds.slice(i, i + CHUNK) } }).lean<StoredEntry[]>()));
  const byKey = new Map(storedEntries.map((r) => [`${r.sourceMessageId}|${r.source}|${r.ordinal}`, r]));
  const planned = new Set<string>();
  const entryOps: Parameters<typeof ServiceTimeEntry.bulkWrite>[0] = [];
  for (const e of plan.entries) {
    const sourceMessageId = messageId.get(key(e.spaceExternalId, e.messageExternalId))!;
    const k = `${sourceMessageId}|${e.source}|${e.ordinal}`;
    planned.add(k);
    const existing = byKey.get(k);
    if (!existing) {
      entryOps.push({ insertOne: { document: { _id: randomUUID(), sourceMessageId, source: e.source, ordinal: e.ordinal, projectId: null, allocations: [], ...fields(e) } } });
      out.entriesCreated++;
    } else if (humanDecided(existing)) {
      out.entriesKeptAsReviewed++;
    } else {
      const data = fields(e);
      if (!sameEntry(existing, data)) entryOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: data } } });
      out.entriesUpdated++;
    }
  }
  await bulk(entryOps, ServiceTimeEntry);

  // Entries left over from an earlier version of an edited message (fewer blocks now) are removed unless reviewed.
  const staleIds = storedEntries.filter((r) => !planned.has(`${r.sourceMessageId}|${r.source}|${r.ordinal}`) && !humanDecided(r)).map((r) => r._id);
  if (staleIds.length) {
    await ServiceTimeEntry.deleteMany({ _id: { $in: staleIds } });
    out.entriesRemoved += staleIds.length;
  }

  for (const s of spaces) {
    await ServiceSyncCheckpoint.updateOne({ spaceId: spaceId.get(s.externalId)!, month: plan.month }, { $set: { completedAt: new Date() } }, { upsert: true });
  }

  if (opts.followUps !== false) await runFollowUps();
  return out;
}

/** After hours change: place entries of multi-project clients, list reporters on their projects, apply the 45-day rule. */
export async function runFollowUps() {
  await autoAssignProjects();
  await syncReporters();
  await applyActivityRules();
}
