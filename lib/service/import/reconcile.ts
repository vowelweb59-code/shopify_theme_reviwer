// Compares the ON-timer figure written in a manual report with the hours calculated from timer messages, then
// produces the final ON figure (owner: "compare both, then push the final report").
// Grouping is per sender + client + day, so two people working the same project the same day never get mixed up.

export const DEFAULT_TOLERANCE_MINUTES = 15;

export type OnTimerCheck =
  | { status: 'MATCH'; finalMinutes: number; confirmed: true }
  | { status: 'NO_REPORTED_ON'; finalMinutes: number; confirmed: true }
  | { status: 'MISMATCH'; finalMinutes: number; confirmed: false; reportedMinutes: number; diffMinutes: number }
  | { status: 'NO_TIMER_DATA'; finalMinutes: number; confirmed: false; reportedMinutes: number };

/**
 * Timer-calculated minutes are authoritative because they come from timestamps. The reported figure only confirms,
 * contradicts, or (when there are no timer messages at all) stands in unverified. Nothing is silently overwritten:
 * a mismatch keeps the timer value and surfaces both numbers for the reviewer.
 */
export function reconcileOnTimer(timerMinutes: number | null, reportedOnMinutes: number | null, toleranceMinutes = DEFAULT_TOLERANCE_MINUTES): OnTimerCheck | null {
  if (timerMinutes === null && reportedOnMinutes === null) return null;
  if (timerMinutes === null) return { status: 'NO_TIMER_DATA', finalMinutes: reportedOnMinutes!, confirmed: false, reportedMinutes: reportedOnMinutes! };
  if (reportedOnMinutes === null) return { status: 'NO_REPORTED_ON', finalMinutes: timerMinutes, confirmed: true };
  const diff = Math.abs(timerMinutes - reportedOnMinutes);
  if (diff <= toleranceMinutes) return { status: 'MATCH', finalMinutes: timerMinutes, confirmed: true };
  return { status: 'MISMATCH', finalMinutes: timerMinutes, confirmed: false, reportedMinutes: reportedOnMinutes, diffMinutes: diff };
}
