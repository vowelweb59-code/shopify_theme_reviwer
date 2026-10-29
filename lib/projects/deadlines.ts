import type { ProjectStatus } from "./constants";

// The Deadlines page: one row per project that has a due date. A finished project
// (Live / Completed) has no more use for a deadline, so its date is its last report.
const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;

export const FINISHED_STATUSES: readonly ProjectStatus[] = ["live", "completed"];

export type DeadlineState = "finished" | "overdue" | "due_soon" | "on_track" | "no_deadline";

export type DeadlineInfo = {
  /** The date shown: the last report for a finished project, otherwise the deadline set by hand (YYYY-MM-DD). */
  date: string | null;
  source: "last_report" | "set" | null;
  state: DeadlineState;
  /** Open project: days until the deadline (negative = overdue). Null otherwise. */
  daysLeft: number | null;
  /** Finished project with a deadline set: days its last report came after it (0 = on time). Null when there's nothing to compare. */
  lateByDays: number | null;
};

const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);

/** Dates are "YYYY-MM-DD" strings; `today` is the day in IST (todayInIst). */
export function deadlineInfo(input: { status: ProjectStatus | null; deadline: string | null; lastReportOn: string | null; today: string }): DeadlineInfo {
  const finished = input.status !== null && FINISHED_STATUSES.includes(input.status);
  if (finished) {
    if (!input.lastReportOn) return { date: null, source: null, state: "finished", daysLeft: null, lateByDays: null };
    const lateBy = input.deadline ? Math.max(0, daysBetween(input.deadline, input.lastReportOn)) : null;
    return { date: input.lastReportOn, source: "last_report", state: "finished", daysLeft: null, lateByDays: lateBy };
  }
  if (!input.deadline) return { date: null, source: null, state: "no_deadline", daysLeft: null, lateByDays: null };
  const daysLeft = daysBetween(input.today, input.deadline);
  const state: DeadlineState = daysLeft < 0 ? "overdue" : daysLeft <= DUE_SOON_DAYS ? "due_soon" : "on_track";
  return { date: input.deadline, source: "set", state, daysLeft, lateByDays: null };
}
