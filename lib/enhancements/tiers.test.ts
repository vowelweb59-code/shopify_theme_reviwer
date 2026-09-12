import { describe, it, expect } from "vitest";
import {
  ADOPTION_TIERS,
  TIER_THRESHOLDS,
  TIER_ORDER,
  TIER_LABELS,
  TIER_BLURBS,
  tierForPercentage,
} from "./tiers";

describe("tierForPercentage", () => {
  it("buckets the documented ranges", () => {
    expect(tierForPercentage(100)).toBe("established");
    expect(tierForPercentage(76.1)).toBe("established");
    expect(tierForPercentage(45.1)).toBe("common");
    expect(tierForPercentage(19.1)).toBe("emerging");
    expect(tierForPercentage(0.3)).toBe("experimental");
    expect(tierForPercentage(0)).toBe("experimental");
  });

  it("treats each threshold as an inclusive lower bound", () => {
    // The boundary values are exactly where an off-by-one would hide: 50%
    // must be "established", not "common".
    expect(tierForPercentage(50)).toBe("established");
    expect(tierForPercentage(49.9)).toBe("common");
    expect(tierForPercentage(20)).toBe("common");
    expect(tierForPercentage(19.9)).toBe("emerging");
    expect(tierForPercentage(5)).toBe("emerging");
    expect(tierForPercentage(4.9)).toBe("experimental");
  });

  it("rejects impossible input rather than reporting it as unpopular", () => {
    expect(() => tierForPercentage(-1)).toThrow(/>= 0/);
    expect(() => tierForPercentage(Number.NaN)).toThrow(/finite/);
    expect(() => tierForPercentage(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

describe("tier metadata", () => {
  it("gives every declared tier a threshold, label and blurb", () => {
    expect([...TIER_ORDER].sort()).toEqual([...ADOPTION_TIERS].sort());
    for (const tier of ADOPTION_TIERS) {
      expect(TIER_LABELS[tier]).toBeTruthy();
      expect(TIER_BLURBS[tier]).toBeTruthy();
    }
  });

  it("orders thresholds most- to least-adopted, ending at zero", () => {
    const mins = TIER_THRESHOLDS.map((t) => t.minPercentage);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    // Without a 0 floor, tierForPercentage(0) would fall through its loop.
    expect(mins.at(-1)).toBe(0);
  });
});
