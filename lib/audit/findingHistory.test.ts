import { describe, expect, it } from "vitest";
import { classifyFindingHistory, type CarriedFinding } from "./findingHistory";
import type { DiffableFinding } from "./findingSignature";

function finding(overrides: Partial<DiffableFinding> = {}): DiffableFinding {
  return {
    ruleId: "A11Y-IMG-ALT-001",
    category: "Accessibility",
    filePath: "sections/hero.liquid",
    severity: "high",
    finding: "Image is missing an alt attribute.",
    ...overrides,
  };
}

describe("classifyFindingHistory", () => {
  it("marks a finding with no prior history at all as first_seen", () => {
    const result = classifyFindingHistory([], [], [finding()]);
    expect(result).toEqual([{ historicalState: "first_seen", carriedStatus: null, carriedIgnoredReason: null }]);
  });

  it("marks a finding matching the immediately preceding run as persistent and carries its status forward", () => {
    const prior: CarriedFinding = { ...finding(), status: "ignored", ignoredReason: "Accepted for this section" };
    const result = classifyFindingHistory([prior], [prior], [finding()]);
    expect(result).toEqual([{ historicalState: "persistent", carriedStatus: "ignored", carriedIgnoredReason: "Accepted for this section" }]);
  });

  it("carries forward a resolved status too, not just ignored", () => {
    const prior: CarriedFinding = { ...finding(), status: "resolved", ignoredReason: null };
    const result = classifyFindingHistory([prior], [prior], [finding()]);
    expect(result[0]).toMatchObject({ historicalState: "persistent", carriedStatus: "resolved" });
  });

  it("does not carry an ignoredReason forward for a non-ignored status", () => {
    const prior: CarriedFinding = { ...finding(), status: "open", ignoredReason: "stale leftover text" };
    const result = classifyFindingHistory([prior], [prior], [finding()]);
    expect(result[0].carriedIgnoredReason).toBeNull();
  });

  it("marks a finding absent from the immediately preceding run but present earlier as reintroduced", () => {
    const olderRun = [finding()];
    // most recent prior run doesn't have this finding at all (it was resolved)
    const result = classifyFindingHistory([], olderRun, [finding()]);
    expect(result).toEqual([{ historicalState: "reintroduced", carriedStatus: null, carriedIgnoredReason: null }]);
  });

  it("does not carry status forward via a location-only match — only an exact signature match qualifies", () => {
    const prior: CarriedFinding = { ...finding({ finding: "Different wording entirely." }), status: "ignored", ignoredReason: "old reason" };
    const result = classifyFindingHistory([prior], [prior], [finding({ finding: "Image is missing an alt attribute." })]);
    // Not an exact match (different message) and it did appear in the most recent run under a different signature,
    // but since exact signatures differ, this specific current finding is genuinely new-to-this-signature history.
    expect(result[0].historicalState).toBe("first_seen");
    expect(result[0].carriedStatus).toBeNull();
  });

  it("classifies each current finding independently in a mixed batch", () => {
    const persistentOne = finding({ filePath: "sections/a.liquid" });
    const reintroducedOne = finding({ filePath: "sections/b.liquid" });
    const newOne = finding({ filePath: "sections/c.liquid" });

    const mostRecentPrior: CarriedFinding[] = [{ ...persistentOne, status: "resolved", ignoredReason: null }];
    const allPrior: DiffableFinding[] = [persistentOne, reintroducedOne];

    const result = classifyFindingHistory(mostRecentPrior, allPrior, [persistentOne, reintroducedOne, newOne]);
    expect(result[0].historicalState).toBe("persistent");
    expect(result[1].historicalState).toBe("reintroduced");
    expect(result[2].historicalState).toBe("first_seen");
  });
});
