// How long a theme was live on the ops demo store, given only what polling
// can know. The public storefront never says *when* a theme was published,
// so each switch is pinned between two checks:
//   went live:  after `startedAfter` (last check that still saw the previous
//               theme) and by `startedAt` (first check that saw this one)
//   went off:   after `lastSeenAt` (last check that saw it) and by `endedAt`
//               (first check that saw its replacement)
// With hourly checks both windows are about an hour wide. A null bound means
// that side is unknown — the first theme ever recorded has no earlier check,
// and records from before hourly checking have no lastSeenAt/startedAfter.

export type LiveRecordTimes = {
  startedAt: string | Date;
  startedAfter?: string | Date | null;
  lastSeenAt?: string | Date | null;
  endedAt?: string | Date | null;
};

export type LiveWindow = {
  /** Earliest possible go-live instant (ms), or null if unknown. */
  startLow: number | null;
  /** Latest possible go-live instant (ms): first seen. */
  startHigh: number;
  /** Earliest possible end (ms); `now` while still live. Null if unknown. */
  endLow: number | null;
  /** Latest possible end (ms); `now` while still live. */
  endHigh: number;
  /** Shortest and longest durations consistent with the checks (null = unbounded). */
  minMs: number | null;
  maxMs: number | null;
  /** Best single estimate, for sorting and for display when the bounds agree. */
  estimateMs: number;
};

const ms = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : null);

export function liveWindow(r: LiveRecordTimes, now: number = Date.now()): LiveWindow {
  const startHigh = ms(r.startedAt)!;
  const startLow = ms(r.startedAfter);
  const ended = ms(r.endedAt);
  const endHigh = ended ?? now;
  const endLow = ended === null ? now : ms(r.lastSeenAt);

  const minMs = endLow === null ? null : Math.max(0, endLow - startHigh);
  const maxMs = startLow === null ? null : Math.max(0, endHigh - startLow);
  // Midpoint of the two windows when both are known; otherwise the old
  // first-seen-to-first-seen figure, which is what the records always held.
  const startMid = startLow === null ? startHigh : (startLow + startHigh) / 2;
  const endMid = endLow === null ? endHigh : (endLow + endHigh) / 2;
  return { startLow, startHigh, endLow, endHigh, minMs, maxMs, estimateMs: Math.max(0, endMid - startMid) };
}

export function formatDuration(msValue: number): string {
  const days = Math.floor(msValue / 86_400_000);
  const hours = Math.floor((msValue % 86_400_000) / 3_600_000);
  if (days === 0 && hours === 0) return "<1h";
  if (days === 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}

/** Hourly checks leave up to ~2h of slack; within that, one estimate reads better than a range. */
export const PRECISE_ENOUGH_MS = 2 * 3_600_000;

/**
 * Duration text that never claims more precision than the checks give:
 * one figure when both ends are pinned within PRECISE_ENOUGH_MS, a range
 * when they're wider, "≥"/"≤" when one side is unknown, and "~" for
 * records from before hourly checking (neither side known). `range` is
 * the full min–max, for a tooltip.
 */
export function describeDuration(w: LiveWindow): { text: string; exact: boolean; range: string | null } {
  const { minMs, maxMs } = w;
  if (minMs !== null && maxMs !== null) {
    const range = `${formatDuration(minMs)} – ${formatDuration(maxMs)}`;
    if (maxMs - minMs <= PRECISE_ENOUGH_MS) return { text: formatDuration(w.estimateMs), exact: true, range };
    return { text: range, exact: false, range };
  }
  if (minMs !== null) return { text: `≥ ${formatDuration(minMs)}`, exact: false, range: null };
  if (maxMs !== null) return { text: `≤ ${formatDuration(maxMs)}`, exact: false, range: null };
  return { text: `~${formatDuration(w.estimateMs)}`, exact: false, range: null };
}
