import { expandAllocations, loadAttribution, projectOf } from "../hours/attribution";
import { ServiceTimeEntry } from "@/models/service-time-entry";

// Owner rule (2026-11-20): "if I am manually completing a project or putting it on hold, consider the closing date the same as the last
// report date". A status move made by hand is therefore dated the project's newest report (anyone's, placed on it, never a future-dated
// typing error), not the day the button was pressed. With no report it keeps the day it was pressed. History is read by date (the latest
// entry decides the current reason), so the date never goes earlier than the project's previous history entry.
export const DATED_BY_LAST_REPORT = ["COMPLETED", "ON_HOLD"] as const;

export function closingDate(i: { lastReport: Date | null; now: Date; latestHistoryAt: Date | null }): Date {
  if (!i.lastReport) return i.now;
  let at = i.lastReport > i.now ? i.now : i.lastReport;
  if (i.latestHistoryAt && i.latestHistoryAt > at) at = i.latestHistoryAt;
  return at;
}

/** The newest report counted toward the project (the same placement as every page), or null when it has none. */
export async function lastReportDate(projectId: string, clientId: string | null, now = new Date()): Promise<Date | null> {
  const rows = await ServiceTimeEntry.find({
    state: { $ne: "REJECTED" },
    minutes: { $gt: 0 },
    entryDate: { $lte: now },
    $or: [{ projectId }, { "allocations.projectId": projectId }, ...(clientId ? [{ projectId: null, clientId, allocations: { $size: 0 } }] : [])],
  })
    .select("projectId clientId minutes entryDate allocations senderExternalId")
    .lean<
      Array<{
        projectId: string | null;
        clientId: string | null;
        minutes: number;
        entryDate: Date;
        allocations: Array<{ projectId: string; minutes: number }>;
        senderExternalId: string;
      }>
    >();
  const att = await loadAttribution();
  let last: Date | null = null;
  for (const e of expandAllocations(rows)) {
    if (projectOf(e, att.owner) !== projectId) continue;
    if (!last || e.entryDate > last) last = e.entryDate;
  }
  return last;
}

/** When a move to `to` should be dated: the last report for COMPLETED / ON_HOLD, otherwise now. */
export async function dateForManualMove(
  to: string,
  project: { _id: string; clientId: string | null; history: Array<{ at: Date }> },
  now = new Date()
): Promise<Date> {
  if (!(DATED_BY_LAST_REPORT as readonly string[]).includes(to)) return now;
  const latestHistoryAt = project.history.length ? new Date(Math.max(...project.history.map((h) => +new Date(h.at)))) : null;
  return closingDate({ lastReport: await lastReportDate(project._id, project.clientId, now), now, latestHistoryAt });
}
