import { describe, expect, it } from "vitest";
import { computeCoverage, computeCoverageByCategory } from "./coverage";

describe("computeCoverage", () => {
  it("computes counts and percentage", () => {
    const result = computeCoverage([{ ruleStatus: "implemented" }, { ruleStatus: "partial" }, { ruleStatus: "not_implemented" }]);
    expect(result).toEqual({ total: 3, implemented: 1, partial: 1, notImplemented: 1, percentage: (1 / 3) * 100 });
  });

  it("returns 0% for an empty requirement set rather than dividing by zero", () => {
    expect(computeCoverage([]).percentage).toBe(0);
  });
});

describe("computeCoverageByCategory", () => {
  it("buckets coverage independently per category", () => {
    const result = computeCoverageByCategory([
      { category: "Accessibility", ruleStatus: "implemented" },
      { category: "Accessibility", ruleStatus: "not_implemented" },
      { category: "Bug", ruleStatus: "implemented" },
    ]);
    expect(result.Accessibility).toEqual({ total: 2, implemented: 1, partial: 0, notImplemented: 1, percentage: 50 });
    expect(result.Bug).toEqual({ total: 1, implemented: 1, partial: 0, notImplemented: 0, percentage: 100 });
  });
});
