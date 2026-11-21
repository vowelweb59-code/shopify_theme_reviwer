import { describe, expect, it } from "vitest";
import { AUTO_IGNORED } from "./plan";
import { monthDateRange, removableTimerIds } from "./stale-timers";

const e = (id: string, source: string, state: string, notes: string[] = []) => ({ _id: id, source, state, notes });

describe("stale timer entries", () => {
  it("removes every timer entry except the ones a person decided on", () => {
    const ids = removableTimerIds([
      e("counted", "TIMER_CALCULATED", "PARSED"),
      e("flagged", "TIMER_CALCULATED", "NEEDS_REVIEW"),
      e("auto-ignored", "TIMER_CALCULATED", "REJECTED", [AUTO_IGNORED]),
      e("approved", "TIMER_CALCULATED", "APPROVED"),
      e("rejected-by-hand", "TIMER_CALCULATED", "REJECTED", ["REJECTED_BY_PERSON"]),
      e("report", "MANUAL_REPORT", "PARSED"),
    ]);
    expect(ids).toEqual(["counted", "flagged", "auto-ignored"]);
  });

  it("covers exactly one month", () => {
    expect(monthDateRange("2026-11")).toEqual({ from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-12-01T00:00:00Z") });
    expect(monthDateRange("2026-12").to).toEqual(new Date("2027-01-01T00:00:00Z"));
  });
});
