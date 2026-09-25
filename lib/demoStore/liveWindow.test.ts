import { describe, expect, it } from "vitest";
import { describeDuration, formatDuration, liveWindow } from "./liveWindow";

const H = 3_600_000;
const t = (iso: string) => new Date(iso).getTime();

describe("liveWindow", () => {
  it("pins an ended period between the checks either side of each switch", () => {
    const w = liveWindow({
      startedAfter: "2026-09-23T13:10:00Z",
      startedAt: "2026-09-23T14:06:00Z",
      lastSeenAt: "2026-09-25T05:30:00Z",
      endedAt: "2026-09-25T06:28:00Z",
    });
    expect(w.startLow).toBe(t("2026-09-23T13:10:00Z"));
    expect(w.endLow).toBe(t("2026-09-25T05:30:00Z"));
    expect(w.minMs).toBe(t("2026-09-25T05:30:00Z") - t("2026-09-23T14:06:00Z"));
    expect(w.maxMs).toBe(t("2026-09-25T06:28:00Z") - t("2026-09-23T13:10:00Z"));
    expect(describeDuration(w)).toMatchObject({ text: "1d 16h", exact: true, range: "1d 15h – 1d 17h" });
  });

  it("runs a live theme up to now", () => {
    const now = t("2026-09-25T10:00:00Z");
    const w = liveWindow({ startedAfter: "2026-09-25T05:30:00Z", startedAt: "2026-09-25T06:28:00Z", lastSeenAt: "2026-09-25T09:31:00Z", endedAt: null }, now);
    expect(w.endLow).toBe(now);
    expect(w.endHigh).toBe(now);
    expect(describeDuration(w).text).toBe("4h"); // ~3h32m–4h30m
  });

  it("gives a lower bound when the go-live side is unknown", () => {
    const now = t("2026-09-25T07:00:00Z");
    const w = liveWindow({ startedAt: "2026-09-25T06:28:00Z", endedAt: null }, now);
    expect(w.maxMs).toBeNull();
    expect(describeDuration(w).text).toBe("≥ <1h");
  });

  it("shows a range when a failed check widened the window", () => {
    const w = liveWindow({ startedAfter: "2026-09-20T00:00:00Z", startedAt: "2026-09-21T00:00:00Z", lastSeenAt: "2026-09-23T00:00:00Z", endedAt: "2026-09-23T01:00:00Z" });
    expect(describeDuration(w)).toMatchObject({ text: "2d 0h – 3d 1h", exact: false });
  });

  it("marks records from before hourly checking as approximate", () => {
    const w = liveWindow({ startedAt: "2026-09-21T05:15:00Z", endedAt: "2026-09-23T14:06:00Z" });
    expect(w.minMs).toBeNull();
    expect(w.maxMs).toBeNull();
    expect(describeDuration(w).text).toBe("~2d 8h");
  });

  it("never goes negative", () => {
    const w = liveWindow({ startedAt: "2026-09-25T06:00:00Z", lastSeenAt: "2026-09-25T05:00:00Z", startedAfter: "2026-09-25T05:00:00Z", endedAt: "2026-09-25T06:00:00Z" });
    expect(w.minMs).toBe(0);
    expect(w.estimateMs).toBeGreaterThanOrEqual(0);
  });
});

describe("formatDuration", () => {
  it("formats days and hours", () => {
    expect(formatDuration(0.5 * H)).toBe("<1h");
    expect(formatDuration(5 * H)).toBe("5h");
    expect(formatDuration(47 * H)).toBe("1d 23h");
  });
});
