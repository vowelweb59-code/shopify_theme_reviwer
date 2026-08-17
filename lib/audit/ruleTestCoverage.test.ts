import { describe, expect, it } from "vitest";
import { ruleHasTestCoverage } from "./ruleTestCoverage";

describe("ruleHasTestCoverage", () => {
  it("returns true when the ruleId appears in the test content", () => {
    const content = 'describe("A11Y-IMG-ALT-001", () => { ... });';
    expect(ruleHasTestCoverage("A11Y-IMG-ALT-001", content)).toBe(true);
  });

  it("returns false when the ruleId does not appear anywhere", () => {
    const content = 'describe("SOME-OTHER-RULE-001", () => { ... });';
    expect(ruleHasTestCoverage("A11Y-IMG-ALT-001", content)).toBe(false);
  });

  it("returns false for an empty test corpus", () => {
    expect(ruleHasTestCoverage("A11Y-IMG-ALT-001", "")).toBe(false);
  });
});
