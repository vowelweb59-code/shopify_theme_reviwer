// A project's status on a given day, read from its status history (owner, 2026-11-23: a project completed on 15 August must look Active
// in the week before, in the overview of that week). Dates are IST calendar dates ("YYYY-MM-DD"); a change counts from the day it was made.

export interface StatusStep {
  fromStatus: string | null;
  toStatus: string;
  at: Date | string;
  /** The real day of a change made by hand whose `at` is the last report date; it decides the status on a day. */
  madeAt?: Date | string | null;
}

/**
 * The status the project had at the end of `day`: the last change made on or before that day. Before its first recorded change it had
 * the status that change moved it away from (or, for a creation entry, the status it was created with). With no history, `current`.
 */
export function statusOnDay<S extends string>(current: S, history: readonly StatusStep[] | undefined, day: string, dayOf: (at: Date) => string): S | string {
  if (!history || history.length === 0) return current;
  const steps = history.map((h) => ({ ...h, day: dayOf(new Date(h.madeAt ?? h.at)), t: +new Date(h.madeAt ?? h.at) })).sort((a, b) => a.t - b.t);
  let status: string | null = null;
  for (const s of steps) if (s.day <= day) status = s.toStatus;
  return status ?? steps[0].fromStatus ?? steps[0].toStatus;
}
