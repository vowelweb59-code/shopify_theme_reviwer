import { describe, expect, it } from "vitest";
import { isAutoHold, NOT_STARTED_HOLD_REASON, shouldHoldNotStarted } from "./activity-rules";

const today = new Date("2026-11-24T18:29:59Z");

describe("shouldHoldNotStarted", () => {
  it("holds a Not started project the team has reported on", () => {
    expect(shouldHoldNotStarted({ lastDm: new Date("2026-11-20T00:00:00Z"), today, history: [] })).toBe(true);
  });
  it("leaves it alone with no team report or only a future-dated one", () => {
    expect(shouldHoldNotStarted({ lastDm: undefined, today, history: [] })).toBe(false);
    expect(shouldHoldNotStarted({ lastDm: new Date("2029-01-01T00:00:00Z"), today, history: [] })).toBe(false);
  });
  it("does not hold again after the owner set it back to Not started", () => {
    expect(shouldHoldNotStarted({ lastDm: new Date("2026-11-20T00:00:00Z"), today, history: [{ reason: NOT_STARTED_HOLD_REASON }] })).toBe(false);
  });
  it("is not an automatic hold that new hours would lift", () => {
    expect(isAutoHold(NOT_STARTED_HOLD_REASON)).toBe(false);
  });
});
