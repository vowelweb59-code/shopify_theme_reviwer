import { describe, expect, it } from "vitest";
import { AUTO_HOLD_DM_REASON, AUTO_HOLD_REASON, holdReason, isAutoHold, workingDaysCutoff } from "./activity-rules";

const day = (d: Date) => d.toISOString().slice(0, 10);

describe("workingDaysCutoff (30 working days, Sundays off, IST)", () => {
  it("counts today and skips Sundays", () => {
    // Mon 16 Nov 2026, 10:00 IST. Tue 13 Oct to Mon 16 Nov = 35 days, 5 of them Sundays: 30 working days.
    expect(day(workingDaysCutoff(new Date("2026-11-16T04:30:00Z")))).toBe("2026-10-13");
  });

  it("uses the IST date (00:30 IST on Tuesday is still Tuesday)", () => {
    expect(day(workingDaysCutoff(new Date("2026-11-16T19:00:00Z"), 1))).toBe("2026-11-17");
  });

  it("does not count a Sunday today", () => {
    // Sun 15 Nov: the one most recent working day is Sat 14 Nov.
    expect(day(workingDaysCutoff(new Date("2026-11-15T06:00:00Z"), 1))).toBe("2026-11-14");
  });
});

describe("isAutoHold", () => {
  it("recognises the old and new wording, not a person", () => {
    expect(isAutoHold("Automatic: no hours for 45 days")).toBe(true);
    expect(isAutoHold("Automatic: no hours for 30 working days")).toBe(true);
    expect(isAutoHold(AUTO_HOLD_DM_REASON)).toBe(true);
    expect(isAutoHold("Client paused")).toBe(false);
    expect(isAutoHold(null)).toBe(false);
  });
});

describe("holdReason", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const base = {
    lastAny: d("2026-11-10"),
    lastDm: d("2026-11-10"),
    hasDmMember: true,
    began: d("2025-01-01"),
    cutoff: d("2026-10-13"),
    dmCutoff: d("2026-09-18"),
  };

  it("does not hold a project the team reported on recently", () => {
    expect(holdReason(base)).toBeNull();
  });
  it("holds a project nobody reported on in 30 working days", () => {
    expect(holdReason({ ...base, lastAny: d("2026-10-01"), lastDm: d("2026-10-01") })).toBe(AUTO_HOLD_REASON);
  });
  it('holds "for DM" when only others reported and no team member did in 60 days', () => {
    expect(holdReason({ ...base, lastDm: d("2026-08-01") })).toBe(AUTO_HOLD_DM_REASON);
    expect(holdReason({ ...base, lastDm: undefined })).toBe(AUTO_HOLD_DM_REASON);
  });
  it("lifts again once a team member reports", () => {
    expect(holdReason({ ...base, lastDm: d("2026-11-14") })).toBeNull();
  });
  it("ignores the team rule when no team member is on the project, or it began inside the 60 days", () => {
    expect(holdReason({ ...base, lastDm: undefined, hasDmMember: false })).toBeNull();
    expect(holdReason({ ...base, lastDm: undefined, began: d("2026-10-20") })).toBeNull();
  });
});
