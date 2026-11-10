// Upwork-style weekly figures for one contract. Computed from entries, never stored, so a corrected entry or a
// re-import fixes every report. Only confirmed hours count as completed; unconfirmed hours are shown beside them.
import { weekOf, type Week } from './week';

export interface HourEntry {
  /** IST calendar date. */
  date: string;
  minutes: number;
  source: 'TIMER_CALCULATED' | 'MANUAL_REPORT';
  /** False while the entry is flagged or awaiting approval. */
  confirmed: boolean;
}

export interface WeeklyHours {
  week: Week;
  /** Null when no weekly limit has been entered for the contract. */
  limitMinutes: number | null;
  completedMinutes: number;
  trackedMinutes: number;
  manualMinutes: number;
  unconfirmedMinutes: number;
  /** "Pending hours": limit minus completed, never below zero. Null without a limit. */
  remainingMinutes: number | null;
  /** Shown explicitly instead of clamping the overage away. */
  overLimitMinutes: number;
  percentUsed: number | null;
}

export function weeklyHours(entries: readonly HourEntry[], limitMinutes: number | null, weekContaining: string): WeeklyHours {
  const week = weekOf(weekContaining);
  const inWeek = entries.filter((e) => e.date >= week.start && e.date <= week.end);
  const sum = (xs: readonly HourEntry[]) => xs.reduce((n, e) => n + e.minutes, 0);
  const confirmed = inWeek.filter((e) => e.confirmed);
  const completed = sum(confirmed);
  return {
    week,
    limitMinutes,
    completedMinutes: completed,
    trackedMinutes: sum(confirmed.filter((e) => e.source === 'TIMER_CALCULATED')),
    manualMinutes: sum(confirmed.filter((e) => e.source === 'MANUAL_REPORT')),
    unconfirmedMinutes: sum(inWeek.filter((e) => !e.confirmed)),
    remainingMinutes: limitMinutes === null ? null : Math.max(limitMinutes - completed, 0),
    overLimitMinutes: limitMinutes === null ? 0 : Math.max(completed - limitMinutes, 0),
    percentUsed: limitMinutes ? Math.round((completed / limitMinutes) * 1000) / 10 : null,
  };
}
