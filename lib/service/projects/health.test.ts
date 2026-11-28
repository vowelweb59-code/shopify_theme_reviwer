import { describe, expect, it } from "vitest";
import { combineHealth, numberReasons, type HealthNumbers } from "./health";

const base: HealthNumbers = {
  status: "ACTIVE",
  kind: "hourly",
  weeklyLimitMinutes: 20 * 60,
  workableMinutes: null,
  totalMinutes: 100 * 60,
  weekMinutes: [10 * 60, 18 * 60, 17 * 60, 16 * 60, 15 * 60, 14 * 60, 15 * 60],
  lastReportDay: "2026-11-27",
  today: "2026-11-28",
};
const texts = (p: HealthNumbers) => numberReasons(p).map((r) => r.text);

describe("numberReasons", () => {
  it("is quiet for a healthy running project", () => {
    expect(numberReasons(base)).toEqual([]);
  });

  it("flags hours well over the weekly limit, not a few minutes over", () => {
    expect(texts({ ...base, weekMinutes: [23 * 60, ...base.weekMinutes.slice(1)] })[0]).toContain("Over the weekly limit");
    expect(numberReasons({ ...base, weekMinutes: [21 * 60, ...base.weekMinutes.slice(1)] })).toEqual([]);
  });

  it("flags a fixed budget that is used up, and only when there is a cap", () => {
    const fixed = { ...base, kind: "fixed" as const, weeklyLimitMinutes: null, workableMinutes: 40 * 60, totalMinutes: 45 * 60 };
    expect(texts(fixed)[0]).toContain("Fixed budget used up");
    expect(numberReasons({ ...fixed, workableMinutes: null })).toEqual([]);
  });

  it("flags hours falling away against the weeks before, not a small project", () => {
    const falling = { ...base, weekMinutes: [5 * 60, 2 * 60, 3 * 60, 16 * 60, 15 * 60, 14 * 60, 15 * 60] };
    expect(texts(falling).some((t) => t.startsWith("Hours are falling"))).toBe(true);
    const tiny = { ...base, weekMinutes: [0, 0, 0, 60, 60, 60, 60] };
    expect(texts(tiny).some((t) => t.startsWith("Hours are falling"))).toBe(false);
  });

  it("flags a long silence", () => {
    expect(texts({ ...base, lastReportDay: "2026-11-17" }).some((t) => t.includes("No report for 11 days"))).toBe(true);
    expect(texts({ ...base, lastReportDay: "2026-11-19" }).some((t) => t.includes("No report for"))).toBe(false);
  });

  it("has no numeric signals for a project that is on hold or closed", () => {
    expect(numberReasons({ ...base, status: "ON_HOLD", lastReportDay: "2026-01-01" })).toEqual([]);
  });
});

describe("combineHealth", () => {
  it("is red on a red chat judgement or any numeric signal, watch on a mild chat concern", () => {
    expect(combineHealth([{ level: "red", reasons: [{ text: "Client unhappy", threads: "T1" }] }], []).red).toBe(true);
    expect(combineHealth([{ level: "ok", reasons: [] }], [{ kind: "numbers", text: "Over the weekly limit" }]).red).toBe(true);
    const w = combineHealth([{ level: "watch", reasons: [{ text: "Slow replies" }] }], []);
    expect(w).toMatchObject({ red: false, watch: true });
    expect(w.reasons[0]).toMatchObject({ kind: "chat", text: "Slow replies" });
  });

  it("is clean when everything is fine", () => {
    expect(combineHealth([{ level: "ok", reasons: [] }], [])).toEqual({ red: false, watch: false, reasons: [] });
  });
});
