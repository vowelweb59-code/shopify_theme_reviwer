import { describe, expect, it } from "vitest";
import { istDay, istMonth, istMonthWindow } from "./ist";

describe("IST helpers", () => {
  it("puts 00:00-05:29 IST on the IST day, not the UTC day", () => {
    expect(istDay(new Date("2026-11-09T19:00:00Z"))).toBe("2026-11-10"); // 00:30 IST on the 10th
    expect(istDay(new Date("2026-11-10T18:29:00Z"))).toBe("2026-11-10"); // 23:59 IST
    expect(istDay(new Date("2026-11-10T18:30:00Z"))).toBe("2026-11-11");
  });
  it("finds the month, going back across a year end", () => {
    expect(istMonth(new Date("2026-11-30T19:00:00Z"))).toBe("2026-12");
    expect(istMonth(new Date("2026-01-15T00:00:00Z"), 2)).toBe("2025-11");
  });
  it("gives the UTC window of an IST month", () => {
    const w = istMonthWindow("2026-12");
    expect(w.from.toISOString()).toBe("2026-11-30T18:30:00.000Z");
    expect(w.to.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });
});
