import { describe, expect, it } from "vitest";
import { statusOnDay } from "./status-at";

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
  it("with no history it is the current status", () => {
    expect(statusOnDay("ON_HOLD", [], "2026-01-01", day)).toBe("ON_HOLD");
    expect(statusOnDay("ON_HOLD", undefined, "2026-01-01", day)).toBe("ON_HOLD");
  });
});
