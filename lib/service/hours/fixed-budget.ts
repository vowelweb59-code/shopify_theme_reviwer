// Fixed-price projects (owner, 2026-11-17: "Janell is a fixed project, $600"): the price divided by the standard rate of $15 an hour is
// the total number of hours that can be worked on it, and the hours worked should not go past that. Pure.
export const STANDARD_RATE_CENTS = 1500;

/** Total workable minutes for a fixed price (cents), or null without a price. $600 -> 40 h. */
export function workableMinutes(fixedPriceCents: number | null | undefined): number | null {
  return fixedPriceCents != null && fixedPriceCents > 0 ? Math.round((fixedPriceCents / STANDARD_RATE_CENTS) * 60) : null;
}
