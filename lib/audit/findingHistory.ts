import { exactSignature, type DiffableFinding } from "./findingSignature";

export type HistoricalState = "first_seen" | "persistent" | "reintroduced";

export type CarriedFinding = DiffableFinding & { status?: string | null; ignoredReason?: string | null };

export type HistoryClassification = {
  historicalState: HistoricalState;
  carriedStatus: string | null;
  carriedIgnoredReason: string | null;
};

/**
 * Classifies each of a new audit run's findings against the theme's full
 * prior history (phase-6 §10-13):
 *
 * - "persistent": matches (exact signature) a finding from the immediately
 *   preceding complete run — its manual open/resolved/ignored status and
 *   ignoredReason are carried forward, so an already-reviewed decision
 *   doesn't silently reset to "open" just because the same issue was
 *   detected again. Only the exact-signature match is used for this,
 *   never the looser location-only match diffFindings.ts falls back to —
 *   phase-6 §12 is explicit that a substantially changed finding should
 *   force the user to review it fresh, not inherit a stale decision.
 * - "reintroduced": doesn't match the immediately preceding run, but does
 *   match some earlier run — the issue was resolved (or looked resolved)
 *   and has now come back.
 * - "first_seen": never appeared before in this theme's history at all.
 *
 * Takes already-fetched data rather than querying the DB itself, so the
 * classification logic is testable without a database.
 */
export function classifyFindingHistory(
  mostRecentPriorFindings: CarriedFinding[],
  allPriorFindings: DiffableFinding[],
  currentFindings: DiffableFinding[]
): HistoryClassification[] {
  const mostRecentBySignature = new Map<string, CarriedFinding>();
  for (const f of mostRecentPriorFindings) {
    mostRecentBySignature.set(exactSignature(f), f);
  }

  const everSeen = new Set(allPriorFindings.map((f) => exactSignature(f)));

  return currentFindings.map((f) => {
    const sig = exactSignature(f);
    const recent = mostRecentBySignature.get(sig);
    if (recent) {
      return {
        historicalState: "persistent",
        carriedStatus: recent.status ?? "open",
        carriedIgnoredReason: recent.status === "ignored" ? (recent.ignoredReason ?? null) : null,
      };
    }
    if (everSeen.has(sig)) {
      return { historicalState: "reintroduced", carriedStatus: null, carriedIgnoredReason: null };
    }
    return { historicalState: "first_seen", carriedStatus: null, carriedIgnoredReason: null };
  });
}
