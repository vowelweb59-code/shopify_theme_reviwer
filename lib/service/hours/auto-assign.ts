// A client with several projects: the words written in the Chat client field decide which project an entry belongs to.
// Each project lists its words ("Stacy King" on one, "Mathew Gerson" on the other). The word written first wins, so
// "Stacy King (Mathew Gerson)" is Stacy's and "Mathew Gerson | Adnan" is Mathew's. When no word is written, two more signs
// decide: the Upwork profile the report names, then the person who posted it (executives listed on one project only).
// Clients set to split unclear entries share what is left across the projects active in the two weeks before it.
// An entry already placed on a project is never moved.
import { normalizeName } from "../import/text";
import { matchSender } from "../projects/sender-name";
import { splitMinutes } from "./attribution";
import { ServiceClient } from "@/models/service-client";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkProfile } from "@/models/service-upwork";

export interface KeywordCandidate {
  projectId: string;
  keywords: readonly string[];
}

export function pickProjectByKeywords(written: string | null | undefined, candidates: readonly KeywordCandidate[]): string | null {
  const text = ` ${normalizeName(written ?? "")} `;
  let best: { projectId: string; at: number; length: number } | null = null;
  for (const c of candidates) {
    for (const kw of c.keywords) {
      const key = normalizeName(kw);
      if (!key) continue;
      const at = text.indexOf(` ${key} `);
      if (at < 0) continue;
      if (!best || at < best.at || (at === best.at && key.length > best.length)) best = { projectId: c.projectId, at, length: key.length };
    }
  }
  return best?.projectId ?? null;
}

const onlyOne = <T>(xs: readonly T[]): T | null => (xs.length === 1 ? xs[0]! : null);
const LOOKBACK_DAYS = 14;
const DAY_MS = 86_400_000;

type Group = {
  candidates: KeywordCandidate[];
  projectIds: string[];
  split: boolean;
  profiles: Array<{ projectId: string; profileId: string; names: Set<string> }>;
  team: Array<{ projectId: string; senderIds: Set<string> }>;
};

/** Places unassigned entries of clients with several live projects. Safe to run again at any time. Returns how many changed. */
export async function autoAssignProjects(clientId?: string): Promise<number> {
  const [projects, senderRows, profiles, splitClients] = await Promise.all([
    ServiceProject.find({ contract: { $ne: null }, "contract.status": { $ne: "ENDED" }, clientId: clientId ?? { $ne: null } })
      .select("clientId chatKeywords upworkProfileId people")
      .lean<Array<{ _id: string; clientId: string; chatKeywords: string[]; upworkProfileId: string | null; people: Array<{ role: string; name: string; senderId: string | null }> }>>(),
    ServiceChatSender.find().select("externalId displayName").lean<Array<{ _id: string; externalId: string; displayName: string }>>(),
    ServiceUpworkProfile.find().select("name aliases").lean<Array<{ _id: string; name: string; aliases: string[] }>>(),
    ServiceClient.find({ splitUnclear: true }).select("_id").lean<Array<{ _id: string }>>(),
  ]);
  const senders = senderRows.map((s) => ({ id: s._id, displayName: s.displayName }));
  const senderByExternal = new Map(senderRows.map((s) => [s.externalId, s._id]));
  const profileById = new Map(profiles.map((p) => [p._id, p]));
  const splitSet = new Set(splitClients.map((c) => c._id));

  const byClient = new Map<string, Group>();
  for (const p of projects) {
    const g = byClient.get(p.clientId) ?? { candidates: [], projectIds: [], split: splitSet.has(p.clientId), profiles: [], team: [] };
    g.projectIds.push(p._id);
    if (p.chatKeywords.length) g.candidates.push({ projectId: p._id, keywords: p.chatKeywords });
    if (p.upworkProfileId) {
      const prof = profileById.get(p.upworkProfileId);
      g.profiles.push({ projectId: p._id, profileId: p.upworkProfileId, names: new Set([prof?.name, ...(prof?.aliases ?? [])].filter((x): x is string => !!x).map(normalizeName)) });
    }
    g.team.push({ projectId: p._id, senderIds: new Set(p.people.filter((x) => x.role === "EXECUTIVE").map((x) => x.senderId ?? matchSender(x.name, senders)).filter((x): x is string => !!x)) });
    byClient.set(p.clientId, g);
  }

  let assigned = 0;
  for (const [cid, g] of byClient) {
    if (g.projectIds.length < 2) continue; // one project owns its client's hours without any rule
    const waiting = await ServiceTimeEntry.find({ clientId: cid, projectId: null, state: { $ne: "REJECTED" } })
      .select("clientRaw profile profileId minutes entryDate allocations senderExternalId")
      .lean<Array<{ _id: string; clientRaw: string | null; profile: string | null; profileId: string | null; minutes: number; entryDate: Date; allocations: Array<{ projectId: string; minutes: number }>; senderExternalId: string }>>();
    const unplaced: typeof waiting = [];
    for (const e of waiting) {
      const sender = senderByExternal.get(e.senderExternalId);
      const projectId =
        pickProjectByKeywords(e.clientRaw, g.candidates) ??
        onlyOne(g.profiles.filter((p) => p.profileId === e.profileId || (e.profile != null && p.names.has(normalizeName(e.profile)))).map((p) => p.projectId)) ??
        onlyOne(g.team.filter((t) => sender && t.senderIds.has(sender)).map((t) => t.projectId));
      if (!projectId) {
        unplaced.push(e);
        continue;
      }
      await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { projectId, allocations: [] } });
      assigned++;
    }
    if (!g.split) continue;

    for (const e of unplaced) {
      if (e.minutes === 0) continue;
      if (e.allocations.length > 0 && e.allocations.reduce((n, a) => n + a.minutes, 0) === e.minutes) continue; // already shared
      const from = new Date(e.entryDate.getTime() - LOOKBACK_DAYS * DAY_MS);
      const active = ((await ServiceTimeEntry.distinct("projectId", {
        clientId: cid, state: { $ne: "REJECTED" }, minutes: { $gt: 0 }, _id: { $ne: e._id },
        entryDate: { $gte: from, $lte: e.entryDate }, projectId: { $in: g.projectIds },
      })) as string[]).sort();
      if (active.length === 0) {
        if (e.allocations.length) await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { allocations: [] } });
        continue; // nothing to share it across: a person decides
      }
      if (active.length === 1) {
        await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { projectId: active[0], allocations: [] } });
      } else {
        const shares = splitMinutes(e.minutes, active.length);
        await ServiceTimeEntry.updateOne({ _id: e._id }, { $set: { allocations: active.map((projectId, i) => ({ projectId, minutes: shares[i]! })) } });
      }
      assigned++;
    }
  }
  return assigned;
}
