import { describe, expect, it } from "vitest";
import {
  computeFindingsDiff,
  countNewOrEscalatedHighRiskFindings,
  summarizeDiffByCategory,
  summarizeDiffBySeverity,
  type DiffableFinding,
} from "./diffFindings";

function finding(overrides: Partial<DiffableFinding>): DiffableFinding {
  return {
    ruleId: "A11Y-IMG-ALT-001",
    category: "Accessibility",
    filePath: "sections/product-card.liquid",
    severity: "high",
    finding: "Image is missing an alt attribute.",
    ...overrides,
  };
}

describe("computeFindingsDiff", () => {
  it("marks an identical finding as still present", () => {
    const prev = [finding({})];
    const cur = [finding({})];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ stillPresent: 1, resolved: 0, new: 0, changed: 0 });
    expect(diff.findings[0].status).toBe("still_present");
  });

  it("marks a finding as resolved when it no longer appears", () => {
    const prev = [finding({})];
    const cur: DiffableFinding[] = [];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ resolved: 1, stillPresent: 0, new: 0, changed: 0 });
  });

  it("marks a finding as new when it only appears in the current audit", () => {
    const prev: DiffableFinding[] = [];
    const cur = [finding({})];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ new: 1, resolved: 0, stillPresent: 0, changed: 0 });
  });

  it("marks a finding as changed when the same rule/location has a different message", () => {
    const prev = [finding({ finding: "Image is missing an alt attribute." })];
    const cur = [finding({ finding: "Image has an empty alt attribute where one is required." })];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ changed: 1, resolved: 0, stillPresent: 0, new: 0 });
  });

  it("does not treat wording/case/whitespace differences alone as changed", () => {
    const prev = [finding({ finding: "Image  is missing an alt attribute." })];
    const cur = [finding({ finding: "image is missing an alt attribute." })];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ stillPresent: 1, changed: 0 });
  });

  it("is insensitive to line-number-only differences, since line number is not part of the signature", () => {
    const prev = [{ ...finding({}), lineNumber: 10 } as DiffableFinding & { lineNumber: number }];
    const cur = [{ ...finding({}), lineNumber: 42 } as DiffableFinding & { lineNumber: number }];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ stillPresent: 1, resolved: 0, new: 0 });
  });

  it("matches duplicates one-to-one rather than collapsing them", () => {
    const prev = [finding({}), finding({})];
    const cur = [finding({})];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ stillPresent: 1, resolved: 1, new: 0, changed: 0 });
  });

  it("treats a different file path as an unrelated finding, not a match", () => {
    const prev = [finding({ filePath: "sections/product-card.liquid" })];
    const cur = [finding({ filePath: "sections/hero.liquid" })];
    const diff = computeFindingsDiff(prev, cur);
    expect(diff.summary).toMatchObject({ resolved: 1, new: 1, stillPresent: 0, changed: 0 });
  });
});

describe("summarizeDiffByCategory", () => {
  it("buckets each diff finding under its own category", () => {
    const prev = [finding({ category: "Accessibility" }), finding({ category: "Bug", filePath: "sections/b.liquid" })];
    const cur = [finding({ category: "Accessibility" })];
    const diff = computeFindingsDiff(prev, cur);
    const summary = summarizeDiffByCategory(diff);
    expect(summary).toEqual([
      { category: "Accessibility", resolved: 0, new: 0, stillPresent: 1, changed: 0 },
      { category: "Bug", resolved: 1, new: 0, stillPresent: 0, changed: 0 },
    ]);
  });
});

describe("summarizeDiffBySeverity", () => {
  it("computes before/after counts and resolved/new per severity", () => {
    const prev = [finding({ severity: "blocker" }), finding({ severity: "blocker", filePath: "sections/b.liquid" })];
    const cur = [finding({ severity: "blocker" }), finding({ severity: "low", filePath: "sections/c.liquid" })];
    const diff = computeFindingsDiff(prev, cur);
    const summary = summarizeDiffBySeverity(diff);
    const blocker = summary.find((s) => s.severity === "blocker")!;
    expect(blocker).toEqual({ severity: "blocker", previousCount: 2, currentCount: 1, resolved: 1, new: 0 });
    const low = summary.find((s) => s.severity === "low")!;
    expect(low).toMatchObject({ previousCount: 0, currentCount: 1, new: 1 });
  });
});

describe("countNewOrEscalatedHighRiskFindings", () => {
  it("counts a brand-new blocker/high finding", () => {
    const diff = computeFindingsDiff([], [finding({ severity: "blocker" })]);
    expect(countNewOrEscalatedHighRiskFindings(diff)).toBe(1);
  });

  it("does not count a new low/medium finding", () => {
    const diff = computeFindingsDiff([], [finding({ severity: "low" })]);
    expect(countNewOrEscalatedHighRiskFindings(diff)).toBe(0);
  });

  it("counts a changed finding whose severity escalated into blocker/high", () => {
    const prev = [finding({ severity: "low", finding: "Old wording." })];
    const cur = [finding({ severity: "blocker", finding: "New wording entirely." })];
    const diff = computeFindingsDiff(prev, cur);
    expect(countNewOrEscalatedHighRiskFindings(diff)).toBe(1);
  });

  it("does not count a changed finding that was already high-risk and stays high-risk", () => {
    const prev = [finding({ severity: "high", finding: "Old wording." })];
    const cur = [finding({ severity: "blocker", finding: "New wording entirely." })];
    const diff = computeFindingsDiff(prev, cur);
    expect(countNewOrEscalatedHighRiskFindings(diff)).toBe(0);
  });

  it("does not count a resolved finding", () => {
    const diff = computeFindingsDiff([finding({ severity: "blocker" })], []);
    expect(countNewOrEscalatedHighRiskFindings(diff)).toBe(0);
  });
});
