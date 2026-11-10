// Owner rule (27 Oct 2026): a project nobody has reported hours on for 45 days is put On hold; as soon as hours arrive again it
// goes back to Active. Only holds this rule placed are lifted by it: a project a person put on hold stays on hold. Runs after
// every import. Closed projects and projects that began less than 45 days ago are never touched.
import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { ServiceProject } from "@/models/service-project";
import { ServiceTimeEntry } from "@/models/service-time-entry";
import { ServiceUpworkContract } from "@/models/service-upwork";

export const IDLE_DAYS = 45;
export const AUTO_HOLD_REASON = `Automatic: no hours for ${IDLE_DAYS} days`;
export const AUTO_RESUME_REASON = "Automatic: hours reported again";
const DAY_MS = 86_400_000;

export interface ActivityResult {
  held: string[];
  resumed: string[];
}

export async function applyActivityRules(now = new Date()): Promise<ActivityResult> {
  const cutoff = new Date(now.getTime() - IDLE_DAYS * DAY_MS);
  const att = await loadAttribution();
  const entries = await ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
    .select("projectId clientId minutes entryDate allocations")
    .lean<Array<{ projectId: string | null; clientId: string | null; minutes: number; entryDate: Date; allocations: Array<{ projectId: string; minutes: number }> }>>();
  const last = new Map<string, Date>();
  const first = new Map<string, Date>();
  for (const e of expandAllocations(entries)) {
    const pid = projectOf(e, att.owner);
    if (!pid) continue;
    if (!last.get(pid) || last.get(pid)! < e.entryDate) last.set(pid, e.entryDate);
    if (!first.get(pid) || first.get(pid)! > e.entryDate) first.set(pid, e.entryDate);
  }

  const projects = await ServiceProject.find({ status: { $in: ["ACTIVE", "ON_HOLD"] } })
    .select("name status createdAt startDate history")
    .lean<Array<{ _id: string; name: string; status: string; createdAt: Date; startDate: Date | null; history: Array<{ reason: string | null; at: Date }> }>>();
  const contractStarts = new Map<string, Date[]>();
  for (const c of await ServiceUpworkContract.find({ projectId: { $in: projects.map((p) => p._id) }, startDate: { $ne: null } }).select("projectId startDate").lean<Array<{ projectId: string; startDate: Date }>>()) {
    contractStarts.set(c.projectId, [...(contractStarts.get(c.projectId) ?? []), c.startDate]);
  }

  const out: ActivityResult = { held: [], resumed: [] };
  for (const p of projects) {
    const lastWork = last.get(p._id);
    const recent = !!lastWork && lastWork >= cutoff;
    const latest = [...p.history].sort((a, b) => +new Date(b.at) - +new Date(a.at))[0];
    if (p.status === "ACTIVE") {
      // A project that only just began has had no time to report yet. Its beginning is the earliest known date; the day it was
      // created here only when nothing else is known (projects imported from history were created long after they began).
      const known = [p.startDate, first.get(p._id), ...(contractStarts.get(p._id) ?? [])].filter((d): d is Date => !!d);
      const began = known.length ? new Date(Math.min(...known.map((d) => new Date(d).getTime()))) : p.createdAt;
      if (recent || began >= cutoff) continue;
      await ServiceProject.updateOne({ _id: p._id, status: "ACTIVE" }, { $set: { status: "ON_HOLD" }, $push: { history: { fromStatus: "ACTIVE", toStatus: "ON_HOLD", reason: AUTO_HOLD_REASON, at: now } } });
      out.held.push(p.name);
    } else if (recent && latest?.reason === AUTO_HOLD_REASON) {
      await ServiceProject.updateOne({ _id: p._id, status: "ON_HOLD" }, { $set: { status: "ACTIVE" }, $push: { history: { fromStatus: "ON_HOLD", toStatus: "ACTIVE", reason: AUTO_RESUME_REASON, at: now } } });
      out.resumed.push(p.name);
    }
  }
  return out;
}
