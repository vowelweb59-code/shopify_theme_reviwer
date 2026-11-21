import { describe, expect, it } from "vitest";
import { computePerformance, type PerfProject } from "./compute";

const project = (o: Partial<PerfProject> & { id: string }): PerfProject => ({
  name: o.id,
  status: "ACTIVE",
  reviewRating: null,
  fixed: false,
  hourlyRateCents: 1500,
  weeklyLimitMinutes: 40 * 60,
  ...o,
});
const e = (member: string, projectId: string, date: string, minutes: number) => ({ member, projectId, date, minutes });
const base = { today: "2026-11-20", weekStart: "2026-11-16", weekEnd: "2026-11-22" };
const by = (r: ReturnType<typeof computePerformance>, k: string) => r.find((m) => m.key === k)!;

describe("computePerformance", () => {
  it("values hours at the project's rate and counts this week", () => {
    const r = computePerformance({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Hamza", "a", "2026-11-17", 120), e("Hamza", "a", "2026-11-02", 60)],
    });
    expect(by(r, "Hamza")).toMatchObject({ totalMinutes: 180, valueCents: 4500, weekMinutes: 120, projectsHandled: 1 });
  });

  it("values fixed work with no rate at $15 and leaves hourly work with no rate unpriced", () => {
    const r = computePerformance({
      ...base,
      projects: [project({ id: "f", fixed: true, hourlyRateCents: null }), project({ id: "h", hourlyRateCents: null })],
      entries: [e("Rupali", "f", "2026-11-10", 60), e("Rupali", "h", "2026-11-10", 60)],
    });
    expect(by(r, "Rupali")).toMatchObject({ valueCents: 1500, unpricedMinutes: 60 });
  });

  it("weights the review rating by the member's hours on each rated project", () => {
    const r = computePerformance({
      ...base,
      projects: [project({ id: "a", reviewRating: 5, status: "COMPLETED" }), project({ id: "b", reviewRating: 3, status: "COMPLETED" }), project({ id: "c" })],
      entries: [e("Batul", "a", "2026-01-05", 180), e("Batul", "b", "2026-01-06", 60), e("Batul", "c", "2026-01-07", 600)],
    });
    const m = by(r, "Batul");
    expect(m.ratedProjects).toBe(2);
    expect(m.weightedRating).toBeCloseTo((5 * 180 + 3 * 60) / 240);
    expect(m.simpleRating).toBe(4);
  });

  it("allocates a member's usual week (last 28 days / 4), whatever the project's quota", () => {
    const r = computePerformance({
      ...base,
      projects: [project({ id: "a", weeklyLimitMinutes: 40 * 60 })],
      entries: [e("Hamza", "a", "2026-11-10", 600), e("Trishul", "a", "2026-11-11", 200), e("Hamza", "a", "2026-09-01", 9000)],
    });
    expect(by(r, "Hamza").allocatedMinutes).toBe(150); // 600 / 4, the old entry is outside the 28 days
    expect(by(r, "Trishul").allocatedMinutes).toBe(50);
    expect(by(r, "Hamza").projects[0].share).toBeCloseTo(0.75);
    expect(by(r, "Hamza").occupancy).toBeCloseTo(150 / (8.5 * 5 * 60));
  });

  it("allocates only running projects the member worked on in the last 28 days", () => {
    const r = computePerformance({
      ...base,
      projects: [project({ id: "run" }), project({ id: "hold", status: "ON_HOLD" }), project({ id: "old" }), project({ id: "part", status: "PARTIAL_HOLD" })],
      entries: [
        e("Neha", "run", "2026-11-10", 240),
        e("Neha", "hold", "2026-11-10", 600),
        e("Neha", "old", "2026-09-01", 600),
        e("Neha", "part", "2026-11-12", 120),
      ],
    });
    expect(by(r, "Neha").allocatedMinutes).toBe(60 + 30);
  });

  it("measures a part-time member against their own availability", () => {
    const half = (8.5 * 5 * 60) / 2;
    const r = computePerformance({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Bhavesh", "a", "2026-11-10", 600)],
      capacityByMember: { Bhavesh: half },
    });
    expect(by(r, "Bhavesh").capacityMinutes).toBe(half);
    expect(by(r, "Bhavesh").occupancy).toBeCloseTo(150 / half);
  });

  it("counts a day worked in full as a full day and every other weekday as a 6-hour half day", () => {
    const rules = { Hamza: { halfDayMinutes: 360, fullDayFromMinutes: 480 } };
    const r = computePerformance({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Hamza", "a", "2026-11-16", 500), e("Hamza", "a", "2026-11-17", 300), e("Trishul", "a", "2026-11-16", 100)],
      dailyRules: rules,
    });
    expect(by(r, "Hamza").capacityMinutes).toBe(510 + 4 * 360);
    expect(by(r, "Trishul").capacityMinutes).toBe(8.5 * 5 * 60);
  });

  it("ignores entries dated after today", () => {
    const r = computePerformance({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Bhavesh", "a", "2029-10-19", 240), e("Bhavesh", "a", "2026-11-10", 60)],
    });
    expect(by(r, "Bhavesh").totalMinutes).toBe(60);
  });
});
