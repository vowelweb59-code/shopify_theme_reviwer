import { describe, expect, it } from "vitest";
import { addDays, chunkDateRange, dateInTimeZone, fromGa4Date, todayInTimeZone } from "./dates";

describe("property time zone dates", () => {
  // 2026-09-23 20:30 UTC is already the 24th in India, still the 23rd in New York.
  const instant = new Date("2026-09-23T20:30:00Z");

  it("computes 'today' in the property's zone, not the server's", () => {
    expect(todayInTimeZone("Asia/Kolkata", instant)).toBe("2026-09-24");
    expect(todayInTimeZone("America/New_York", instant)).toBe("2026-09-23");
    expect(todayInTimeZone(null, instant)).toBe("2026-09-23");
  });

  it("converts a property's createTime to its local date", () => {
    expect(dateInTimeZone("2023-03-31T22:00:00Z", "Asia/Kolkata")).toBe("2023-04-01");
  });
});

describe("date arithmetic", () => {
  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-09-24", -3)).toBe("2026-09-21");
  });

  it("parses GA4's compact date format", () => {
    expect(fromGa4Date("20260923")).toBe("2026-09-23");
    expect(() => fromGa4Date("2026-09-23")).toThrow();
  });
});

describe("chunkDateRange", () => {
  it("covers the range exactly, with a short final chunk", () => {
    expect(chunkDateRange("2026-01-01", "2026-01-10", 4)).toEqual([
      { start: "2026-01-01", end: "2026-01-04" },
      { start: "2026-01-05", end: "2026-01-08" },
      { start: "2026-01-09", end: "2026-01-10" },
    ]);
  });

  it("handles a single day and an empty range", () => {
    expect(chunkDateRange("2026-09-24", "2026-09-24", 30)).toEqual([{ start: "2026-09-24", end: "2026-09-24" }]);
    expect(chunkDateRange("2026-09-25", "2026-09-24", 30)).toEqual([]);
  });
});
