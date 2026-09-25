import { describe, expect, it } from "vitest";
import { DATE_RANGE_PRESETS, DateRangeError, MAX_RANGE_DAYS, datesInRange, previousPeriod, rangeLength, resolvePeriod, resolveRange } from "./dateRanges";

// 2026-09-25 is a Friday.
const TODAY = "2026-09-25";

describe("resolveRange", () => {
  const cases: [string, { start: string; end: string }][] = [
    ["today", { start: "2026-09-25", end: "2026-09-25" }],
    ["yesterday", { start: "2026-09-24", end: "2026-09-24" }],
    ["last7", { start: "2026-09-18", end: "2026-09-24" }],
    ["last30", { start: "2026-08-26", end: "2026-09-24" }],
    ["last90", { start: "2026-06-27", end: "2026-09-24" }],
    ["thisWeek", { start: "2026-09-20", end: "2026-09-25" }],
    ["lastWeek", { start: "2026-09-13", end: "2026-09-19" }],
    ["thisMonth", { start: "2026-09-01", end: "2026-09-25" }],
    ["lastMonth", { start: "2026-08-01", end: "2026-08-31" }],
    ["thisYear", { start: "2026-01-01", end: "2026-09-25" }],
  ];
  it.each(cases)("%s", (preset, expected) => {
    expect(resolveRange({ preset: preset as never }, TODAY)).toEqual(expected);
  });

  it("covers every preset", () => {
    expect(cases.map(([p]) => p).concat("custom").sort()).toEqual([...DATE_RANGE_PRESETS].sort());
  });

  it("last N days are exactly N days, ending yesterday (like GA4)", () => {
    expect(rangeLength(resolveRange({ preset: "last7" }, TODAY))).toBe(7);
    expect(rangeLength(resolveRange({ preset: "last30" }, TODAY))).toBe(30);
    expect(rangeLength(resolveRange({ preset: "last90" }, TODAY))).toBe(90);
  });

  it("starts the week on Sunday, including on a Sunday itself", () => {
    expect(resolveRange({ preset: "thisWeek" }, "2026-09-20")).toEqual({ start: "2026-09-20", end: "2026-09-20" });
    expect(resolveRange({ preset: "lastWeek" }, "2026-09-20")).toEqual({ start: "2026-09-13", end: "2026-09-19" });
  });

  it("handles month and year boundaries and leap years", () => {
    expect(resolveRange({ preset: "lastMonth" }, "2028-03-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(resolveRange({ preset: "lastMonth" }, "2026-01-15")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(resolveRange({ preset: "yesterday" }, "2026-01-01")).toEqual({ start: "2025-12-31", end: "2025-12-31" });
    expect(resolveRange({ preset: "thisWeek" }, "2026-01-02")).toEqual({ start: "2025-12-28", end: "2026-01-02" });
  });

  it("accepts a valid custom range as-is", () => {
    expect(resolveRange({ preset: "custom", start: "2026-02-01", end: "2026-02-28" }, TODAY)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it.each([
    [{ start: "2026-02-01" }, /both/],
    [{ start: "2026-02-30", end: "2026-03-01" }, /real calendar dates/],
    [{ start: "2026-13-01", end: "2026-12-01" }, /real calendar dates/],
    [{ start: "2026-01-01", end: "2026-01-32" }, /real calendar dates/],
    [{ start: "2026/02/01", end: "2026-03-01" }, /real calendar dates/],
    [{ start: "2026-03-02", end: "2026-03-01" }, /on or before/],
    [{ start: "2015-01-01", end: "2015-12-31" }, /no data before/],
    [{ start: "2020-01-01", end: "2026-01-01" }, new RegExp(`${MAX_RANGE_DAYS} days`)],
  ])("rejects an invalid custom range %j", (bounds, message) => {
    expect(() => resolveRange({ preset: "custom", ...bounds }, TODAY)).toThrow(DateRangeError);
    expect(() => resolveRange({ preset: "custom", ...bounds }, TODAY)).toThrow(message);
  });
});

describe("previousPeriod", () => {
  it("is the same number of days immediately before", () => {
    expect(previousPeriod({ start: "2026-09-18", end: "2026-09-24" })).toEqual({ start: "2026-09-11", end: "2026-09-17" });
    expect(previousPeriod({ start: "2026-09-25", end: "2026-09-25" })).toEqual({ start: "2026-09-24", end: "2026-09-24" });
  });

  it("uses GA4's preceding-period rule for calendar presets", () => {
    // This month so far (25 days) vs the 25 days before the 1st.
    expect(previousPeriod(resolveRange({ preset: "thisMonth" }, TODAY))).toEqual({ start: "2026-08-07", end: "2026-08-31" });
    // Last month (31 days) vs the 31 days before it.
    expect(previousPeriod(resolveRange({ preset: "lastMonth" }, TODAY))).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });
});

describe("resolvePeriod", () => {
  // 20:00 UTC on the 24th is already 01:30 on the 25th in Kolkata.
  const now = new Date("2026-09-24T20:00:00Z");

  it("resolves 'today' in the property's time zone, not the server's", () => {
    expect(resolvePeriod({ preset: "today" }, "Asia/Kolkata", false, now).current).toEqual({ start: "2026-09-25", end: "2026-09-25" });
    expect(resolvePeriod({ preset: "today" }, "America/Los_Angeles", false, now).current).toEqual({ start: "2026-09-24", end: "2026-09-24" });
    expect(resolvePeriod({ preset: "today" }, null, false, now).current).toEqual({ start: "2026-09-24", end: "2026-09-24" });
  });

  it("adds the previous period only when comparing", () => {
    expect(resolvePeriod({ preset: "last7" }, "UTC", false, now).previous).toBeNull();
    expect(resolvePeriod({ preset: "last7" }, "UTC", true, now)).toEqual({
      current: { start: "2026-09-17", end: "2026-09-23" },
      previous: { start: "2026-09-10", end: "2026-09-16" },
    });
  });
});

describe("datesInRange", () => {
  it("lists every date inclusively", () => {
    expect(datesInRange({ start: "2026-02-27", end: "2026-03-02" })).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});
