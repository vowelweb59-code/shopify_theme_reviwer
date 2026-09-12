// This module is imported by the client-side /enhancements page, so it must
// stay free of any Mongoose import — `models/enhancement-point.ts` takes its
// enum FROM here rather than the other way around, which keeps mongoose out
// of the browser bundle while still leaving one definition of the tiers.

// How widely a capability is adopted across the themes analysed. Measured,
// not assigned: the share of distinct themes whose release notes ship it.
export const ADOPTION_TIERS = ["established", "common", "emerging", "experimental"] as const;

export type AdoptionTier = (typeof ADOPTION_TIERS)[number];

// Single source of truth for adoption bucketing. The research aggregator
// (scripts/research/aggregate-release-notes.mjs) also prints a tier in its
// console summary, but the seed script recomputes it from here so the value
// actually stored — and the labels the UI renders — can never drift apart.
//
// Thresholds are inclusive lower bounds on "% of analysed themes whose
// release notes ship this capability".
export const TIER_THRESHOLDS: { tier: AdoptionTier; minPercentage: number }[] = [
  { tier: "established", minPercentage: 50 },
  { tier: "common", minPercentage: 20 },
  { tier: "emerging", minPercentage: 5 },
  { tier: "experimental", minPercentage: 0 },
];

/** Most- to least-adopted. Drives section order on the /enhancements page. */
export const TIER_ORDER: AdoptionTier[] = TIER_THRESHOLDS.map((t) => t.tier);

export const TIER_LABELS: Record<AdoptionTier, string> = {
  established: "Established",
  common: "Common",
  emerging: "Emerging",
  experimental: "Experimental",
};

export const TIER_BLURBS: Record<AdoptionTier, string> = {
  established: "Shipped by more than half the store — effectively table stakes.",
  common: "Shipped by 20–50% of the store — expected in a competitive theme.",
  emerging: "Shipped by 5–20% — a differentiator today, likely baseline soon.",
  experimental: "Under 5% — too rare to call a trend, kept for visibility.",
};

/**
 * Bucket an adoption percentage into a tier.
 *
 * Negative input is a bug upstream rather than an "unpopular" capability, so
 * it throws instead of silently reporting "experimental" — a 0% point and a
 * miscomputed one should not look identical on the page.
 */
export function tierForPercentage(percentage: number): AdoptionTier {
  if (!Number.isFinite(percentage) || percentage < 0) {
    throw new Error(`adoption percentage must be a finite number >= 0, got ${percentage}`);
  }
  for (const { tier, minPercentage } of TIER_THRESHOLDS) {
    if (percentage >= minPercentage) return tier;
  }
  // Unreachable: the last threshold is 0 and percentage is >= 0 here.
  return "experimental";
}
