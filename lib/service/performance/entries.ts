import "server-only";
import { senderNames } from "../api/hours";
import { dmMatch } from "../dm-members";
import { loadAllTimeEntries } from "../hours/all-time";
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import type { PerfEntry } from "./compute";

/** Every counted entry of a Digital Marketing member, placed on its project (the same placement as every page), with the member's key. */
export async function entriesForDm() {
  const [entries, att, names] = await Promise.all([loadAllTimeEntries(), loadAttribution(), senderNames()]);
  const out: PerfEntry[] = [];
  const hours = new Map<string, Map<string, number>>();
  for (const e of expandAllocations(entries)) {
    const sender = names.get(e.senderExternalId);
    const key = dmMatch(sender);
    const pid = projectOf(e, att.owner);
    if (!key || !sender || !pid) continue;
    out.push({ projectId: pid, member: key, minutes: e.minutes, date: e.entryDate.toISOString().slice(0, 10) });
    const m = hours.get(key) ?? new Map<string, number>();
    m.set(sender, (m.get(sender) ?? 0) + e.minutes);
    hours.set(key, m);
  }
  // A member's display name: the spelling with the most hours.
  const nameOf = new Map([...hours].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
  return { entries: out, nameOf, keyOf: (name: string) => dmMatch(name) };
}
