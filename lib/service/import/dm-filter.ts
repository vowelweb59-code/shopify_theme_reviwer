// Owner, 2026-11-16: the live Service section keeps the Digital Marketing team's hours, plus anyone else's hours on a PROJECT the
// team works on ("Andrew Johnson has 2 projects: an HR website front end and marketing; both should be separated").
// Only the team's projects exist on the live site, so a client whose other project is not ours looks like it has one project and
// would take every unplaced hour. Hence, for someone outside the team, an entry is kept only when it is tied to one of the team's
// projects by (1) a project keyword written in the client field (not just the client's name), or (2) the poster being on exactly
// one of the client's team projects (BA/BD/executive or assigned). The project is then written on the entry. Anything else from
// outside the team is dropped. Pure: takes the full plan and the team's projects.
import { dmMatch } from "../dm-members";
import { pickProjectByKeywords } from "../hours/auto-assign";
import { normalizeName } from "./text";
import type { ImportPlan, PlannedEntry } from "./plan";

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

export function projectForOutsider(e: Pick<PlannedEntry, "clientId" | "clientRaw" | "senderName">, byClient: ReadonlyMap<string, readonly DmProject[]>): string | null {
  if (!e.clientId) return null;
  const projects = byClient.get(e.clientId);
  if (!projects?.length) return null;
  const candidates = projects.map((p) => {
    const own = new Set(p.clientNames.map(normalizeName));
    return { projectId: p.id, keywords: p.keywords.filter((k) => !own.has(normalizeName(k))) };
  });
  const byKeyword = pickProjectByKeywords(e.clientRaw, candidates);
  if (byKeyword) return byKeyword;
  const onTeam = projects.filter((p) => p.teamNames.some((n) => samePerson(e.senderName, n)));
  return onTeam.length === 1 ? onTeam[0]!.id : null;
}

export function filterPlanToDigitalMarketing(plan: ImportPlan, dmProjects: readonly DmProject[]): ImportPlan {
  const byClient = new Map<string, DmProject[]>();
  for (const p of dmProjects) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p]);

  const entries: PlannedEntry[] = [];
  for (const e of plan.entries) {
    if (dmMatch(e.senderName) !== null) {
      entries.push(e);
      continue;
    }
    const projectId = projectForOutsider(e, byClient);
    if (projectId) entries.push({ ...e, projectId });
  }
  const needed = new Set<string>();
  for (const e of entries) {
    needed.add(`${e.spaceExternalId}|${e.messageExternalId}`);
    if (e.startMessageExternalId) needed.add(`${e.spaceExternalId}|${e.startMessageExternalId}`);
  }
  const messages = plan.messages.filter((m) => dmMatch(m.senderName) !== null || needed.has(`${m.spaceExternalId}|${m.externalId}`));
  return { ...plan, messages, entries, summary: { ...plan.summary, messages: messages.length, entries: entries.length } };
}
