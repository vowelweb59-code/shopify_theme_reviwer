import { describe, expect, it } from "vitest";
import { addWorkingDays, averageDays, daysFromHours, extraDays } from "./benchmarks";

describe("averageDays", () => {
  it("averages the projects that took time and counts them", () => {
    expect(averageDays([10, 20, 0, 30])).toEqual({ days: 20, sample: 3 });
    expect(averageDays([8.5, 8.5, 9])).toEqual({ days: 8.67, sample: 3 });
  });
  it("is null when nothing was finished with hours", () => {
    expect(averageDays([])).toBeNull();
    expect(averageDays([0, 0])).toBeNull();
  });
});

describe("daysFromHours", () => {
  it("is 8.5 hours per day", () => {
    expect(daysFromHours(17)).toBe(2);
    expect(daysFromHours(4)).toBe(0.47);
  });
});

describe("addWorkingDays", () => {
  it("counts the first day and skips Sundays", () => {
    // 2026-11-09 is a Monday.
    expect(addWorkingDays("2026-11-09", 1)).toBe("2026-11-09");
    expect(addWorkingDays("2026-11-09", 5)).toBe("2026-11-13");
    expect(addWorkingDays("2026-11-09", 6)).toBe("2026-11-14"); // Saturday works
    expect(addWorkingDays("2026-11-09", 7)).toBe("2026-11-16"); // Sunday the 15th is skipped
  });
  it("rounds a fraction up and starts a Sunday start on Monday", () => {
    expect(addWorkingDays("2026-11-09", 2.1)).toBe("2026-11-11");
    expect(addWorkingDays("2026-11-15", 1)).toBe("2026-11-16");
  });
});

describe("extraDays", () => {
  it("is what exceeds the budget, zero within it, null without a budget", () => {
    expect(extraDays(12.5, 10)).toBe(2.5);
    expect(extraDays(8, 10)).toBe(0);
    expect(extraDays(8, null)).toBeNull();
  });
});
