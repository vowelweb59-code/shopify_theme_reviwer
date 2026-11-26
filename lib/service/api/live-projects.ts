import { connectToDatabase } from "@/lib/db/connect";
import { senderNames } from "@/lib/service/api/hours";
import { dmMatch } from "@/lib/service/dm-members";
import { loadAllTimeEntries } from "@/lib/service/hours/all-time";
import { expandAllocations, loadAttribution, projectOf } from "@/lib/service/hours/attribution";
import { istDate } from "@/lib/service/import/text";
import { isMovedToOtherDept } from "@/lib/service/projects/dept-placement";
import { ServiceProject } from "@/models/service-project";

// The projects on the Service overview's Active tab TODAY (owner, 2026-11-26: "a tab for each active project" in Live Project Chat Summary):
// status Active, Blocked or Partial hold, minus the Active ones the overview shows under "Moved to another department" (same shared rule,
// `isMovedToOtherDept`, 30 calendar days, manual placement honoured). Waiting for client counts as On hold there, so it is not listed.
export interface LiveProject {
  id: string;
  name: string;
}

const MOVED_DAYS = 30;

export async function listLiveProjects(now = new Date()): Promise<LiveProject[]> {
  await connectToDatabase();
  const [rows, att, names, entries] = await Promise.all([
    ServiceProject.find({ status: { $in: ["ACTIVE", "BLOCKED", "PARTIAL_HOLD"] } })
      .select("name status deptOverride")
      .sort({ name: 1 })
      .lean<Array<{ _id: string; name: string; status: string; deptOverride?: "STAY" | "MOVED" | null }>>(),
    loadAttribution(),
    senderNames(),
    loadAllTimeEntries(),
  ]);
  const today = istDate(now);
  const lastAnyDay = new Map<string, string>();
  const lastDmDay = new Map<string, string>();
  for (const e of expandAllocations(entries)) {
    const pid = projectOf(e, att.owner);
    if (!pid) continue;
    const day = e.entryDate.toISOString().slice(0, 10);
    if (day > today) continue; // dates after today are typing errors
    if (day > (lastAnyDay.get(pid) ?? "")) lastAnyDay.set(pid, day);
    if (dmMatch(names.get(e.senderExternalId)) !== null && day > (lastDmDay.get(pid) ?? "")) lastDmDay.set(pid, day);
  }
  const movedCutoff = new Date(new Date(`${today}T00:00:00Z`).getTime() - MOVED_DAYS * 86_400_000).toISOString().slice(0, 10);
  return rows
    .filter((p) => !isMovedToOtherDept(p, lastAnyDay.get(p._id) ?? "", lastDmDay.get(p._id) ?? "", movedCutoff))
    .map((p) => ({ id: p._id, name: p.name }));
}
