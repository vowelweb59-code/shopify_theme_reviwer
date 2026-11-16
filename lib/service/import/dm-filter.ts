// Owner, 2026-11-16: the live Service section keeps the Digital Marketing team's hours AND anyone else's hours on a client the
// team has a project for ("if anyone is working on the project with my team on it, fetch their reports and hours too").
// Pure: takes a full plan and the ids of clients that have a project here, returns the plan without the rest.
import { dmMatch } from "../dm-members";
import type { ImportPlan } from "./plan";

export function filterPlanToDigitalMarketing(plan: ImportPlan, dmClientIds: ReadonlySet<string>): ImportPlan {
  const entries = plan.entries.filter((e) => dmMatch(e.senderName) !== null || (e.clientId !== null && dmClientIds.has(e.clientId)));
  const needed = new Set<string>();
  for (const e of entries) {
    needed.add(`${e.spaceExternalId}|${e.messageExternalId}`);
    if (e.startMessageExternalId) needed.add(`${e.spaceExternalId}|${e.startMessageExternalId}`);
  }
  const messages = plan.messages.filter((m) => dmMatch(m.senderName) !== null || needed.has(`${m.spaceExternalId}|${m.externalId}`));
  return { ...plan, messages, entries, summary: { ...plan.summary, messages: messages.length, entries: entries.length } };
}
