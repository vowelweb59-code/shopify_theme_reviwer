import { describe, expect, it } from "vitest";
import { closeByLastReport, statusOnDay } from "./status-at";

const day = (d: Date) => d.toISOString().slice(0, 10);
const history = [
  { fromStatus: null, toStatus: "ACTIVE", at: "2026-06-01T05:00:00Z" },
  { fromStatus: "ACTIVE", toStatus: "COMPLETED", at: "2026-08-15T05:00:00Z" },
  { fromStatus: "COMPLETED", toStatus: "ACTIVE", at: "2026-10-01T05:00:00Z" },
];

describe("statusOnDay", () => {
  it("is Active in the week before a project was completed", () => {
    expect(statusOnDay("ACTIVE", history, "2026-08-14", day)).toBe("ACTIVE");
    expect(statusOnDay("ACTIVE", history, "2026-08-09", day)).toBe("ACTIVE");
  });
  it("is Completed from the day it was completed until it was reopened", () => {
    expect(statusOnDay("ACTIVE", history, "2026-08-15", day)).toBe("COMPLETED");
    expect(statusOnDay("ACTIVE", history, "2026-09-30", day)).toBe("COMPLETED");
    expect(statusOnDay("ACTIVE", history, "2026-10-01", day)).toBe("ACTIVE");
  });
  it("before its first recorded change it had the status that change moved it from", () => {
    const h = [{ fromStatus: "ACTIVE", toStatus: "COMPLETED", at: "2026-08-15T05:00:00Z" }];
    expect(statusOnDay("COMPLETED", h, "2026-01-01", day)).toBe("ACTIVE");
    expect(statusOnDay("ACTIVE", history, "2026-01-01", day)).toBe("ACTIVE");
  });
  it("a change made by hand counts from the day it was made, not the last report date it was dated with", () => {
    const h = [{ fromStatus: "ACTIVE", toStatus: "COMPLETED", at: "2026-11-20T05:00:00Z", madeAt: "2026-11-23T08:00:00Z" }];
    expect(statusOnDay("COMPLETED", h, "2026-11-22", day)).toBe("ACTIVE");
    expect(statusOnDay("COMPLETED", h, "2026-11-23", day)).toBe("COMPLETED");
  });
  it("a closing recorded by a rule is dated the last report, a closing made by hand is not moved", () => {
    const rule = [{ fromStatus: "ACTIVE", toStatus: "COMPLETED", at: "2026-10-27T05:00:00Z" }];
    const moved = closeByLastReport(rule, "2025-03-04", day);
    expect(statusOnDay("COMPLETED", moved, "2025-03-03", day)).toBe("ACTIVE");
    expect(statusOnDay("COMPLETED", moved, "2025-03-04", day)).toBe("COMPLETED");
    const byHand = [{ fromStatus: "ACTIVE", toStatus: "COMPLETED", at: "2026-11-20T05:00:00Z", madeAt: "2026-11-23T08:00:00Z" }];
    expect(statusOnDay("COMPLETED", closeByLastReport(byHand, "2026-11-20", day), "2026-11-22", day)).toBe("ACTIVE");
    expect(closeByLastReport(rule, undefined, day)).toEqual(rule);
  });
  it("a closing moved back before the creation entry still closes the project", () => {
    const h = [
      { fromStatus: null, toStatus: "ACTIVE", at: "2026-10-27T05:00:00Z" },
      { fromStatus: "ACTIVE", toStatus: "COMPLETED", at: "2026-10-27T06:00:00Z" },
    ];
    const moved = closeByLastReport(h, "2025-03-04", day);
    expect(statusOnDay("COMPLETED", moved, "2026-10-31", day)).toBe("COMPLETED");
    expect(statusOnDay("COMPLETED", moved, "2025-03-03", day)).toBe("ACTIVE");
  });
  it("with no history it is the current status", () => {
    expect(statusOnDay("ON_HOLD", [], "2026-01-01", day)).toBe("ON_HOLD");
    expect(statusOnDay("ON_HOLD", undefined, "2026-01-01", day)).toBe("ON_HOLD");
  });
});
