import { describe, expect, it } from "vitest";
import { computeAnalytics, type AProject } from "./compute";

const project = (o: Partial<AProject> & { id: string }): AProject => ({
  name: o.id,
  status: "ACTIVE",
  reviewRating: null,
  fixed: false,
  hourlyRateCents: 1500,
  weeklyLimitMinutes: null,
  clientId: "c1",
  profile: "Batul",
  people: [],
  ...o,
});
const e = (member: string, projectId: string, date: string, minutes: number) => ({ member, projectId, date, minutes });
// 2026-11-21 is a Saturday: its week starts Monday 2026-11-16 (the unfinished current week).
const base = { today: "2026-11-21", fromDate: null, capacityMinutes: 2550, capacityByMember: {}, clientNames: { c1: "Alpha", c2: "Beta", c3: "Gamma" } };

describe("computeAnalytics", () => {
  it("adds hours and value, and ranks clients by value with their share", () => {
    const r = computeAnalytics({
      ...base,
      projects: [project({ id: "a" }), project({ id: "b", clientId: "c2", hourlyRateCents: 3000 })],
      entries: [e("Hamza", "a", "2026-11-02", 600), e("Hamza", "b", "2026-11-03", 600)],
    });
    expect(r.kpis).toMatchObject({ minutes: 1200, valueCents: 15000 + 30000, clients: 2, projects: 2 });
    expect(r.clients.map((c) => c.name)).toEqual(["Beta", "Alpha"]);
    expect(r.clients[0].share).toBeCloseTo(30000 / 45000);
    expect(r.concentration.top1).toBeCloseTo(30000 / 45000);
    expect(r.concentration.top5).toBeCloseTo(1);
  });

  it("builds a week line with capacity from the members active in the last four weeks, and ignores the unfinished week in rankings", () => {
    const r = computeAnalytics({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Hamza", "a", "2026-11-02", 1275), e("Trishul", "a", "2026-11-03", 2550), e("Trishul", "a", "2026-11-18", 5000)],
      capacityByMember: { Hamza: 1275 },
    });
    const w = r.weekly.find((x) => x.start === "2026-11-02")!;
    expect(w.minutes).toBe(3825);
    expect(w.capacityMinutes).toBe(1275 + 2550);
    expect(w.utilization).toBeCloseTo(1);
    expect(r.weekly.at(-1)!.current).toBe(true);
    expect(r.bestWeeks.byHours[0].start).toBe("2026-11-02"); // the 5000 minutes are in the current week
  });

  it("ranks person-weeks by hours and by capacity (a half-day member against their own capacity)", () => {
    const r = computeAnalytics({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Hamza", "a", "2026-11-03", 1200), e("Trishul", "a", "2026-11-03", 1800)],
      capacityByMember: { Hamza: 1275 },
    });
    expect(r.personWeeks.byHours[0].member).toBe("Trishul");
    expect(r.personWeeks.byCapacity[0].member).toBe("Hamza");
    expect(r.personWeeks.byCapacity[0].pct).toBeCloseTo(1200 / 1275);
  });

  it("measures a day-rule member week by week: full days count in full, the other weekdays as 6 hours", () => {
    const rules = { Hamza: { halfDayMinutes: 360, fullDayFromMinutes: 480 } };
    const r = computeAnalytics({
      ...base,
      projects: [project({ id: "a" })],
      entries: [e("Hamza", "a", "2026-11-02", 510), e("Hamza", "a", "2026-11-03", 510), e("Hamza", "a", "2026-11-10", 300)],
      dailyRules: rules,
    });
    const full = r.personWeeks.byHours.find((x) => x.start === "2026-11-02")!;
    const half = r.personWeeks.byHours.find((x) => x.start === "2026-11-09")!;
    expect(full.capacityMinutes).toBe(2 * 510 + 3 * 360);
    expect(half.capacityMinutes).toBe(5 * 360);
  });

  it("counts one BD written two ways as one person", () => {
    const r = computeAnalytics({
      ...base,
      projects: [
        project({ id: "a", people: [{ role: "BUSINESS_DEVELOPER", name: "Aliasger B" }] }),
        project({
          id: "b",
          people: [
            { role: "BUSINESS_DEVELOPER", name: "Ali Asger Bagichawala" },
            { role: "BUSINESS_DEVELOPER", name: "Aliasger B" },
          ],
        }),
      ],
      entries: [e("Hamza", "a", "2026-11-02", 600), e("Hamza", "b", "2026-11-03", 600)],
    });
    expect(r.bds).toHaveLength(1);
    expect(r.bds[0]).toMatchObject({ name: "Ali Asger Bagichawala", projects: 2, valueCents: 30000 });
  });

  it("limits to the range and counts new projects by their first report ever", () => {
    const r = computeAnalytics({
      ...base,
      fromDate: "2026-11-01",
      projects: [project({ id: "old" }), project({ id: "new" })],
      entries: [e("Hamza", "old", "2026-09-01", 600), e("Hamza", "old", "2026-11-02", 60), e("Hamza", "new", "2026-11-03", 60)],
    });
    expect(r.kpis.minutes).toBe(120);
    expect(r.monthly.find((m) => m.month === "2026-11")).toMatchObject({ newProjects: 1 });
  });

  it("weights ratings by hours and counts the status mix and rating histogram", () => {
    const r = computeAnalytics({
      ...base,
      projects: [project({ id: "a", reviewRating: 5, status: "COMPLETED" }), project({ id: "b", reviewRating: 3, status: "COMPLETED" }), project({ id: "c" })],
      entries: [e("Neha", "a", "2026-11-02", 180), e("Neha", "b", "2026-11-03", 60), e("Neha", "c", "2026-11-04", 600)],
    });
    expect(r.kpis.rating).toBeCloseTo((5 * 180 + 3 * 60) / 240);
    expect(r.statusMix).toEqual([
      { status: "COMPLETED", count: 2 },
      { status: "ACTIVE", count: 1 },
    ]);
    expect(r.ratingHistogram).toEqual([0, 0, 1, 0, 1]);
  });
});
