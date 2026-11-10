// The people who post reports on a project are its team. After an import, anyone with counted hours on a project who is not
// already listed (by name or as the same Chat sender) is added as an executive. Nobody is removed; rejected or zero-minute
// entries never add anyone.
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { matchSender } from "./sender-name";
import { ServiceChatSender } from "@/models/service-chat";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";

export async function syncReporters(): Promise<number> {
  const [entries, senderRows, projects, att] = await Promise.all([
    ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } }).select("projectId clientId minutes allocations senderExternalId").lean<Array<{ projectId: string | null; clientId: string | null; minutes: number; allocations: Array<{ projectId: string; minutes: number }>; senderExternalId: string }>>(),
    ServiceChatSender.find().select("externalId displayName").lean<Array<{ _id: string; externalId: string; displayName: string }>>(),
    ServiceProject.find().select("people").lean<Array<{ _id: string; people: Array<{ role: string; name: string; senderId: string | null }> }>>(),
    loadAttribution(),
  ]);
  const senders = senderRows.map((s) => ({ id: s._id, displayName: s.displayName }));
  const senderByExternal = new Map(senderRows.map((s) => [s.externalId, s]));
  const reporters = new Map<string, Set<string>>();
  for (const e of expandAllocations(entries)) {
    if (e.minutes <= 0) continue;
    const pid = projectOf(e, att.owner);
    const s = senderByExternal.get(e.senderExternalId);
    if (!pid || !s) continue;
    (reporters.get(pid) ?? reporters.set(pid, new Set()).get(pid)!).add(s._id);
  }
  const byId = new Map(senderRows.map((s) => [s._id, s]));
  const peopleOf = new Map(projects.map((p) => [p._id, p.people]));
  let added = 0;
  for (const [projectId, ids] of reporters) {
    const listed = peopleOf.get(projectId) ?? [];
    const covered = new Set(listed.map((p) => p.senderId ?? matchSender(p.name, senders)).filter((x): x is string => !!x));
    const names = new Set(listed.filter((p) => p.role === "EXECUTIVE").map((p) => p.name.toLowerCase()));
    const rows = [...ids].map((id) => byId.get(id)!).filter((s) => !covered.has(s._id) && !names.has(s.displayName.toLowerCase())).map((s) => ({ role: "EXECUTIVE", name: s.displayName.slice(0, 80), senderId: s._id }));
    if (rows.length) {
      await ServiceProject.updateOne({ _id: projectId }, { $push: { people: { $each: rows } } });
      added += rows.length;
    }
  }
  return added;
}
