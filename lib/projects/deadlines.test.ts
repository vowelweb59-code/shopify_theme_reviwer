import { describe, expect, it } from "vitest";
import { deadlineInfo } from "./deadlines";

const today = "2026-10-29";

describe("deadlineInfo", () => {
  it("uses the last report date for a finished project, whatever deadline was set", () => {
    expect(deadlineInfo({ status: "live", deadline: "2026-10-20", lastReportOn: "2026-10-25", today })).toMatchObject({ date: "2026-10-25", source: "last_report", state: "finished", lateByDays: 5 });
    expect(deadlineInfo({ status: "completed", deadline: "2026-11-01", lastReportOn: "2026-10-25", today })).toMatchObject({ date: "2026-10-25", state: "finished", lateByDays: 0 });
    expect(deadlineInfo({ status: "live", deadline: null, lastReportOn: "2026-10-25", today })).toMatchObject({ date: "2026-10-25", lateByDays: null });
  });

  it("has no date for a finished project that never reported", () => {
    expect(deadlineInfo({ status: "live", deadline: "2026-10-20", lastReportOn: null, today })).toMatchObject({ date: null, state: "finished" });
  });

  it("flags an open project as overdue, due soon or on track", () => {
    expect(deadlineInfo({ status: "under_development", deadline: "2026-10-28", lastReportOn: null, today })).toMatchObject({ state: "overdue", daysLeft: -1 });
    expect(deadlineInfo({ status: "under_development", deadline: "2026-10-29", lastReportOn: null, today })).toMatchObject({ state: "due_soon", daysLeft: 0 });
    expect(deadlineInfo({ status: "planning", deadline: "2026-11-05", lastReportOn: null, today })).toMatchObject({ state: "due_soon", daysLeft: 7 });
    expect(deadlineInfo({ status: "planning", deadline: "2026-11-06", lastReportOn: null, today })).toMatchObject({ state: "on_track", daysLeft: 8 });
  });

  it("has no deadline for an open project that was never given one", () => {
    expect(deadlineInfo({ status: "planning", deadline: null, lastReportOn: "2026-10-25", today })).toMatchObject({ date: null, state: "no_deadline" });
  });
});
