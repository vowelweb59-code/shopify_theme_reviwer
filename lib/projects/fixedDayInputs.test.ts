import { describe, expect, it } from "vitest";
import { computeThemeCosts, UNDATED, type Person } from "./cost";
import { fixedDayInputs } from "./fixedDayInputs";

describe("fixedDayInputs", () => {
  const junaid = "a1";
  const people = new Map<string, Person>([[junaid, { name: "Junaid", designation: "UI/UX Designer", monthlySalary: 22100 }]]); // 100 per hour

  it("prices fixed days of one named person as undated build hours (8.5 h a day)", () => {
    const inputs = fixedDayInputs([{ _id: "p1", themeId: "t1", designDays: 2, designDaysBy: junaid, developmentDays: 5 }], (p) => p.themeId);
    expect(inputs).toEqual([{ themeId: "t1", memberId: junaid, line: "build", hours: 17, month: UNDATED }]);
    expect(computeThemeCosts(inputs, people).get("t1")?.cost.build).toBe(1700);
  });

  it("leaves days with no recorded person, and other project types, unpriced", () => {
    expect(fixedDayInputs([{ _id: "p1", themeId: "t1", designDays: 2 }], (p) => p.themeId)).toEqual([]);
    expect(fixedDayInputs([{ _id: "p2", themeId: "t1", type: "preset_development", designDays: 2, designDaysBy: junaid }], (p) => p.themeId)).toEqual([]);
  });
});

describe("fixedDayInputs with a split", () => {
  it("shares the days between people by their shares, ahead of a single recorded person", () => {
    const inputs = fixedDayInputs(
      [{ _id: "p1", themeId: "t1", developmentDays: 10, developmentDaysBy: "x", developmentDaysSplit: [{ memberId: "a", share: 0.6 }, { memberId: "b", share: 0.4 }] }],
      (p) => p.themeId
    );
    expect(inputs.map((i) => [i.memberId, i.hours])).toEqual([["a", 51], ["b", 34]]);
  });
});
