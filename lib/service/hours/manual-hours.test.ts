import { describe, expect, it } from "vitest";
import { MAX_MANUAL_MINUTES, isManualSender, manualMinutes } from "./manual-hours";

describe("manualMinutes", () => {
  it("adds the hours and the minutes", () => {
    expect(manualMinutes(2, 30)).toBe(150);
    expect(manualMinutes("1.5", "")).toBe(90);
    expect(manualMinutes(undefined, 45)).toBe(45);
    expect(manualMinutes("0.25", 0)).toBe(15);
  });

  it("refuses nothing, negatives, text and absurd amounts", () => {
    expect(() => manualMinutes(0, 0)).toThrow(/Enter the hours/);
    expect(() => manualMinutes("", "")).toThrow(/Enter the hours/);
    expect(() => manualMinutes(-1, 0)).toThrow(/zero or more/);
    expect(() => manualMinutes("abc", 0)).toThrow(/must be a number/);
    expect(() => manualMinutes(MAX_MANUAL_MINUTES / 60 + 1, 0)).toThrow(/more than/);
  });

  it("recognises the pseudo sender", () => {
    expect(isManualSender("manual")).toBe(true);
    expect(isManualSender("users/123")).toBe(false);
  });
});
