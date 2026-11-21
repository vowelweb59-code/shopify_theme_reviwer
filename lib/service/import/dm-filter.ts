// Owner, 2026-11-21 (Shefali's "Racheal Francis | Rahul" report was dropped because she is not on that project's list): "the total allotted
// hours of a client are the same for all teams, we need to consider the hours of every member in a project". So an outsider's entry is kept
// whenever it names a client the team has a project with: no longer only when the poster is on the project's people list or writes a project
// keyword. The project is written on the entry when it is the only one (or the only one the poster is on); with several the normal placement
// rules choose. What follows is the history of the rule it replaces.
//
// Owner, 2026-11-16: the live Service section keeps the Digital Marketing team's hours, plus anyone else's hours on a PROJECT the
// team works on ("Andrew Johnson has 2 projects: an HR website front end and marketing; both should be separated").
// Only the team's projects exist on the live site, so a client whose other project is not ours looks like it has one project and
// would take every unplaced hour. Hence, for someone outside the team, an entry is kept only when it is tied to one of the team's
// projects by (1) a project keyword written in the client field (not just the client's name), or (2) the poster being on one of the
// client's team projects (BA/BD/executive or assigned; owner 2026-11-17: anyone on the project's people list counts). The project is
// written on the entry when it is exactly one; a poster on several of the client's team projects is kept with no project written
// (the normal placement rules choose). Anything else from outside the team is dropped. Pure: takes the full plan and the team's projects.
import { dmMatch } from "../dm-members";
import { pickProjectByKeywords } from "../hours/auto-assign";
import { extractClient, findClientByFirstWord, findClientInText } from "./client-field";
import type { KnownClient } from "./client-match";
import { normalizeName } from "./text";
import type { ImportPlan, PlannedEntry } from "./plan";

/**
 * Client names the owner declared NOT Digital Marketing work (2026-11-18 to 11-21), written the way the team's reports spell them. A team member's
 * report naming one of them, with no client matched, is dropped instead of waiting in Review: removing such entries by hand did not last, because
 * their Chat messages stay (other reports share them) and every re-read or sync rebuilds the entries from those messages. Only entries with no
 * client are dropped, so a client later created with that name is not affected. Hajara Hussain / Summur used to be on this list: she is a client now.
 */
export const NOT_DM_CLIENTS: readonly RegExp[] = [
  /sandra ro(?:se|use)/i,
  /sandra\s*\|\s*zajal/i,
  /yahya sh/i,
  /stellar vloeren/i,
  /jay hwang/i,
  /siddhant doshi|dreamzhub/i,
  /lily \(noma/i,
  /^s robert\b/i,
  /carl martin/i,
  /kutaisi airport/i,
];
export const isNotDmClient = (raw: string | null | undefined) => !!raw && NOT_DM_CLIENTS.some((re) => re.test(raw));

export interface DmProject {
  id: string;
  clientId: string;
  /** The client's own name and aliases: a keyword equal to one of them names the client, not this project. */
  clientNames: readonly string[];
  keywords: readonly string[];
  /** Names of the people on the project (BA/BD/executive, assigned users, linked Chat senders). */
  teamNames: readonly string[];
}

/** Same name rule as the rest of the import: the whole name, or a one-word name against the first word. */
function samePerson(sender: string, member: string): boolean {
  const s = normalizeName(sender);
  const m = normalizeName(member);
  if (!s || !m) return false;
  if (s === m) return true;
  return !m.includes(" ") && s.split(" ")[0] === m;
}

/**
 * An outsider's entry with no client (the written name matched none of the known clients, e.g. "Tim | Adnan" for "Tim Fitz") used to be
 * dropped, and its Chat message with it (owner, 2026-11-19: Tim Fitz showed 100 h, the team had worked 150+ with front end people
 * reporting too). Now the name is tried against ONLY the clients whose team projects list this person, with the importer's usual
 * rules (whole name written, a typo, the first name alone); one clear answer keeps the entry attached to that client, anything else
 * still drops it, so the filter stays as narrow as before.
 */
function guessClientAmongTeam(e: Pick<PlannedEntry, "clientRaw" | "senderName">, byClient: ReadonlyMap<string, readonly DmProject[]>): KnownClient | null {
  const raw = e.clientRaw?.trim();
  if (!raw) return null;
  const known: KnownClient[] = [];
  const everyone: KnownClient[] = [];
  for (const [clientId, projects] of byClient) {
    for (const name of projects[0]!.clientNames) {
      everyone.push({ id: clientId, name });
      if (projects.some((p) => p.teamNames.some((n) => samePerson(e.senderName, n)))) known.push({ id: clientId, name });
    }
  }
  if (known.length) {
    const m = extractClient(raw, known).match;
    if (m.status === "EXACT" || m.status === "CORRECTED") return m.client;
    const hit = findClientInText(raw, known) ?? findClientByFirstWord(raw, known);
    if (hit) return hit;
  }
  // Every member's hours count (owner, 2026-11-21): then any client the team has a project with, but only on a clear match (the whole
  // name written or a typo of it), never on a first name alone.
  const m = extractClient(raw, everyone).match;
  if (m.status === "EXACT" || m.status === "CORRECTED") return m.client;
  return findClientInText(raw, everyone);
}

/** `null` = drop; `{ projectId: null }` = keep, placement left to the normal rules; otherwise keep and write the project. `clientId` is set only when the client was identified here. */
export function projectForOutsider(
  e: Pick<PlannedEntry, "clientId" | "clientRaw" | "senderName">,
  byClient: ReadonlyMap<string, readonly DmProject[]>
): { projectId: string | null; clientId?: string } | null {
  let clientId = e.clientId;
  let guessed = false;
  if (!clientId) {
    const g = guessClientAmongTeam(e, byClient);
    if (!g) return null;
    clientId = g.id;
    guessed = true;
  }
  const projects = byClient.get(clientId);
  if (!projects?.length) return null;
  const candidates = projects.map((p) => {
    const own = new Set(p.clientNames.map(normalizeName));
    return { projectId: p.id, keywords: p.keywords.filter((k) => !own.has(normalizeName(k))) };
  });
  const extra = guessed ? { clientId } : {};
  const byKeyword = pickProjectByKeywords(e.clientRaw, candidates);
  if (byKeyword) return { projectId: byKeyword, ...extra };
  // The projects the poster is on, else all of the client's team projects (owner, 2026-11-21: every member's hours count).
  const onTeam = projects.filter((p) => p.teamNames.some((n) => samePerson(e.senderName, n)));
  const pool = onTeam.length ? onTeam : projects;
  return { projectId: pool.length === 1 ? pool[0]!.id : null, ...extra };
}

export function filterPlanToDigitalMarketing(plan: ImportPlan, dmProjects: readonly DmProject[]): ImportPlan {
  const byClient = new Map<string, DmProject[]>();
  for (const p of dmProjects) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);

  const entries: PlannedEntry[] = [];
  for (const e of plan.entries) {
    if (dmMatch(e.senderName) !== null) {
      if (!e.clientId && isNotDmClient(e.clientRaw)) continue;
      entries.push(e);
      continue;
    }
    const placed = projectForOutsider(e, byClient);
    if (!placed) continue;
    let kept: PlannedEntry = placed.projectId ? { ...e, projectId: placed.projectId } : e;
    if (placed.clientId) {
      const flags = (e.flags ?? []).filter((f) => f !== "UNKNOWN_CLIENT" && f !== "AMBIGUOUS_CLIENT");
      kept = { ...kept, clientId: placed.clientId, flags, state: e.state === "REJECTED" ? e.state : flags.length ? "NEEDS_REVIEW" : "PARSED" };
    }
    entries.push(kept);
  }
  const needed = new Set<string>();
  for (const e of entries) {
    needed.add(`${e.spaceExternalId}|${e.messageExternalId}`);
    if (e.startMessageExternalId) needed.add(`${e.spaceExternalId}|${e.startMessageExternalId}`);
  }
  const messages = plan.messages.filter((m) => dmMatch(m.senderName) !== null || needed.has(`${m.spaceExternalId}|${m.externalId}`));
  return { ...plan, messages, entries, summary: { ...plan.summary, messages: messages.length, entries: entries.length } };
}
