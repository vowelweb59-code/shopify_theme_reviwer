// Manual hours (owner, 2026-11-23: "an option to add manual hours: they are allocated to the project but go to no team member unless I
// allocate them to someone"). A manual entry is a normal time entry (`source` MANUAL_ADDED) placed on its project, with no Chat message.
// Its sender is the pseudo sender below until the owner allocates it to a team member; allocating swaps in that member's real Chat sender,
// so from then on it counts as the member's hours everywhere (performance, analytics, revenue). Unallocated, it counts for the project
// (Everyone, revenue) but for nobody (not under "My team only", not in any person's totals).

export const MANUAL_SOURCE = "MANUAL_ADDED";
export const MANUAL_SENDER_ID = "manual";
export const MANUAL_SENDER_NAME = "Manual hours (not allocated)";
/** The longest single manual entry: a month of full days, to catch a typed 2500 for 2.5. */
export const MAX_MANUAL_MINUTES = 200 * 60;

/** Minutes from the hours and minutes fields of the form; throws a readable message for anything not usable. */
export function manualMinutes(hours: unknown, minutes: unknown): number {
  const num = (v: unknown, name: string) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a number, zero or more.`);
    return n;
  };
  const total = Math.round(num(hours, "Hours") * 60 + num(minutes, "Minutes"));
  if (total <= 0) throw new Error("Enter the hours, or the minutes, worked.");
  if (total > MAX_MANUAL_MINUTES) throw new Error(`That is more than ${MAX_MANUAL_MINUTES / 60} hours in one entry.`);
  return total;
}

export const isManualSender = (senderExternalId: string) => senderExternalId === MANUAL_SENDER_ID;
