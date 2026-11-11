import { describe, expect, it } from "vitest";
import { intervalMs } from "./intervalMinutes";

describe("intervalMs", () => {
  it("uses the default when unset, empty or not a number", () => {
    expect(intervalMs(undefined, 15)).toBe(15 * 60_000);
    expect(intervalMs("", 15)).toBe(15 * 60_000);
    expect(intervalMs("  ", 15)).toBe(15 * 60_000);
    expect(intervalMs("fifteen", 15)).toBe(15 * 60_000);
  });
  it("rejects zero and negative values", () => {
    expect(intervalMs("0", 30)).toBe(30 * 60_000);
    expect(intervalMs("-5", 30)).toBe(30 * 60_000);
  });
  it("accepts a valid value and enforces the minimum", () => {
    expect(intervalMs("10", 15)).toBe(10 * 60_000);
    expect(intervalMs("0.1", 15, 1)).toBe(60_000);
  });
});
