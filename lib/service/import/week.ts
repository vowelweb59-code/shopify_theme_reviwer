// Reporting weeks (owner, 2026-10-26): the week starts Monday; the team works Monday to Saturday. A week's reports can
// still be added until the following Monday 17:30 IST. Dates are IST calendar dates ("YYYY-MM-DD"). Sunday is bucketed
// into the same week so no recorded hour is ever lost.
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export interface Week {
  /** Monday. */
  start: string;
  /** Sunday. */
  end: string;
}

const utcMidnight = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function weekOf(isoDate: string): Week {
  const ms = utcMidnight(isoDate);
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  const start = ms - sinceMonday * DAY_MS;
  return { start: isoOf(start), end: isoOf(start + 6 * DAY_MS) };
}

/** Monday 17:30 IST after the week ends (12:00 UTC). */
export function reportingDeadline(week: Week): Date {
  return new Date(utcMidnight(week.end) + DAY_MS + 12 * 3_600_000);
}

export type WeekStatus = 'FUTURE' | 'CURRENT' | 'GRACE' | 'CLOSED';

/** GRACE = the week is over but reports are still accepted. */
export function weekStatus(week: Week, now: Date): WeekStatus {
  const startUtc = utcMidnight(week.start) - IST_OFFSET_MS;
  const endUtc = utcMidnight(week.end) + DAY_MS - IST_OFFSET_MS;
  if (now.getTime() < startUtc) return 'FUTURE';
  if (now.getTime() < endUtc) return 'CURRENT';
  return now.getTime() <= reportingDeadline(week).getTime() ? 'GRACE' : 'CLOSED';
}

/** A report posted after its week's deadline is late: it is kept, but flagged for approval. */
export const isLateReport = (entryDate: string, postedAt: Date): boolean => postedAt.getTime() > reportingDeadline(weekOf(entryDate)).getTime();
