import { describe, expect, it } from "vitest";
import { computeThemeCosts, hourlyCost, HOURS_PER_MONTH, type Person } from "./cost";

const people = new Map<string, Person>([
  ["dev", { name: "Dev", designation: "Shopify Developer", monthlySalary: 22100 }], // 100 per hour
  ["designer", { name: "Designer", designation: "UI/UX Designer", monthlySalary: 44200 }], // 200 per hour
  ["new", { name: "New hire", designation: "Shopify Developer", monthlySalary: null }],
]);

describe("hourlyCost", () => {
  it("is the monthly salary over 26 days of 8.5 hours", () => {
    expect(HOURS_PER_MONTH).toBe(221);
    expect(hourlyCost(22100)).toBe(100);
    expect(hourlyCost(null)).toBeNull();
    expect(hourlyCost(undefined)).toBeNull();
  });
});

describe("computeThemeCosts", () => {
  it("prices each line at the reporter's own rate and totals them", () => {
    const result = computeThemeCosts(
      [
        { themeId: "t1", memberId: "dev", line: "build", hours: 10, month: "2026-10" },
        { themeId: "t1", memberId: "designer", line: "build", hours: 5, month: "2026-10" },
        { themeId: "t1", memberId: "dev", line: "presets", hours: 2, month: "2026-10" },
        { themeId: "t1", memberId: "dev", line: "updates", hours: 1, month: "2026-10" },
        { themeId: "t2", memberId: "designer", line: "build", hours: 1, month: "2026-10" },
      ],
      people
    );
    expect(result.get("t1")?.cost).toEqual({ build: 2000, presets: 200, updates: 100, total: 2300 });
    expect(result.get("t1")?.hours).toEqual({ build: 15, presets: 2, updates: 1, total: 18 });
    expect(result.get("t2")?.cost.total).toBe(200);
  });

  it("counts a person with no salary in the hours but not the cost, and says how many hours that is", () => {
    const result = computeThemeCosts(
      [
        { themeId: "t1", memberId: "dev", line: "build", hours: 1, month: "2026-10" },
        { themeId: "t1", memberId: "new", line: "build", hours: 4.5, month: "2026-10" },
      ],
      people
    );
    const t1 = result.get("t1");
    expect(t1?.cost.total).toBe(100);
    expect(t1?.hours.total).toBe(5.5);
    expect(t1?.unpricedHours).toBe(4.5);
    expect(t1?.people.find((p) => p.name === "New hire")).toMatchObject({ hours: 4.5, cost: null });
  });

  it("splits cost and hours by the month they were worked, oldest first", () => {
    const t = computeThemeCosts(
      [
        { themeId: "t1", memberId: "dev", line: "build", hours: 2, month: "2026-11" },
        { themeId: "t1", memberId: "dev", line: "build", hours: 1, month: "2026-10" },
        { themeId: "t1", memberId: "designer", line: "updates", hours: 1, month: "2026-11" },
        { themeId: "t1", memberId: "new", line: "build", hours: 3, month: "2026-10" },
      ],
      people
    ).get("t1");
    expect(t?.byMonth).toEqual([
      { month: "2026-10", cost: 100, hours: 4 },
      { month: "2026-11", cost: 400, hours: 3 },
    ]);
  });

  it("lists people by cost, and a removed member as unpriced", () => {
    const t = computeThemeCosts(
      [
        { themeId: "t1", memberId: "dev", line: "build", hours: 1, month: "2026-10" },
        { themeId: "t1", memberId: "designer", line: "build", hours: 1, month: "2026-10" },
        { themeId: "t1", memberId: "gone", line: "updates", hours: 2, month: "2026-10" },
      ],
      people
    ).get("t1");
    expect(t?.people.map((p) => p.name)).toEqual(["Designer", "Dev", "Removed member"]);
    expect(t?.people[2]).toMatchObject({ cost: null, hours: 2 });
  });
});
