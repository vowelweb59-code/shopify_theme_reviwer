import { AUTO_IGNORED } from "./plan";

// Timer entries no longer exist (owner, 2026-11-21: only the daily reports count, the TIMER ON / OFF messages make no entry). Entries made
// by the older rules would stay in the database for messages the Digital Marketing filter drops (a person outside the team), because the
// save step only cleans up the messages of the plan. So every save also removes the leftover timer entries of its month, except the ones a
// person decided on (approved, or rejected by hand), which are kept like any reviewed entry.

/** First day of the IST month "YYYY-MM" and of the next one, as the UTC dates entries are stored with. */
export function monthDateRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/** Ids of the stored timer entries a save should remove. */
export function removableTimerIds(entries: ReadonlyArray<{ _id: string; source: string; state: string; notes: string[] }>): string[] {
  const humanDecided = (e: { state: string; notes: string[] }) =>
    e.state === "APPROVED" || (e.state === "REJECTED" && !e.notes.includes("DUPLICATE_POST") && !e.notes.includes(AUTO_IGNORED));
  return entries.filter((e) => e.source === "TIMER_CALCULATED" && !humanDecided(e)).map((e) => e._id);
}
