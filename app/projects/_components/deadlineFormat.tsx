import type { DeadlineInfo } from "@/lib/projects/deadlines";

// Shared by the Deadlines page and each project's Deadline card, so both say the same thing.

/** "2026-10-29" -> "Oct 29, 2026"; the stored day is a calendar date, so no time zone shift. */
export const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

type Timing = Pick<DeadlineInfo, "state" | "daysLeft" | "lateByDays"> & { deadline?: string | null; averageDeadline?: string | null };

export function TimingLabel({ r }: { r: Timing }) {
  switch (r.state) {
    case "overdue":
      return <span className="font-medium text-status-fail-text">Overdue by {plural(-(r.daysLeft ?? 0))}</span>;
    case "due_soon":
      return <span className="font-medium text-status-warning-text">{r.daysLeft === 0 ? "Due today" : `Due in ${plural(r.daysLeft ?? 0)}`}</span>;
    case "on_track":
      return <span className="text-zinc-600 dark:text-zinc-400">{plural(r.daysLeft ?? 0)} left</span>;
    case "finished":
      return r.lateByDays ? (
        <span className="text-status-fail-text">Finished {plural(r.lateByDays)} late</span>
      ) : (
        <span className="font-medium text-status-pass-text">{r.deadline || r.averageDeadline ? "Finished on time" : "Finished"}</span>
      );
    default:
      return <span className="text-zinc-400">No deadline set</span>;
  }
}
