import { describe, expect, it } from "vitest";
import { memberRating, ratingWeight, UNRATED_STARS } from "./score";

describe("ratingWeight", () => {
  it("weighs the extremes more and the middle at 1", () => {
    expect(ratingWeight(5)).toBe(2);
    expect(ratingWeight(4)).toBe(1);
    expect(ratingWeight(3)).toBe(1);
    expect(ratingWeight(UNRATED_STARS)).toBe(1);
    expect(ratingWeight(2)).toBe(2);
    expect(ratingWeight(1)).toBe(3);
  });
  it("is a straight line in between", () => {
    expect(ratingWeight(4.5)).toBeCloseTo(1.5);
    expect(ratingWeight(1.5)).toBeCloseTo(2.5);
  });
});

describe("memberRating", () => {
  it("counts an unrated project as 3.5 stars", () => {
    expect(memberRating([{ rating: null, minutes: 600 }])).toBe(3.5);
  });
  it("pulls a member with 5-star work above the plain mean", () => {
    // 5 stars (weight 2) and 4 stars (weight 1), equal hours: (5*2 + 4*1) / 3 = 4.667, plain mean 4.5.
    expect(
      memberRating([
        { rating: 5, minutes: 60 },
        { rating: 4, minutes: 60 },
      ])
    ).toBeCloseTo(14 / 3);
  });
  it("pulls a member with 1 and 2 star work below the plain mean", () => {
    // 1 star (weight 3) and 4 stars (weight 1): (1*3 + 4*1) / 4 = 1.75, plain mean 2.5.
    expect(
      memberRating([
        { rating: 1, minutes: 60 },
        { rating: 4, minutes: 60 },
      ])
    ).toBeCloseTo(1.75);
  });
  it("weights by hours and stays between 1 and 5; no hours gives null", () => {
    const r = memberRating([
      { rating: 5, minutes: 180 },
      { rating: null, minutes: 60 },
    ])!;
    expect(r).toBeGreaterThan(3.5);
    expect(r).toBeLessThanOrEqual(5);
    expect(memberRating([])).toBeNull();
    expect(memberRating([{ rating: 5, minutes: 0 }])).toBeNull();
  });
});
