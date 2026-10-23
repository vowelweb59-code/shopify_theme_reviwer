import { describe, expect, it } from "vitest";
import { designShare, projectTotals, resolveFixed } from "./totals";

describe("projectTotals", () => {
  it("adds the space hours on top of the fixed days, split design and development by role", () => {
    const t = projectTotals({ designDays: 31, developmentDays: 51 }, [
      { minutes: 510, designation: "UI/UX Designer" }, // 1 design day
      { minutes: 1020, designation: "Sr Shopify Developer" }, // 2 development days
      { minutes: 255, designation: "QA Engineer" }, // total hours only
      { minutes: 9999, designation: "Product Manager" }, // never counted
    ]);
    expect(t).toMatchObject({ designDays: 32, developmentDays: 53, spaceHours: 29.75, fixedHours: 697, totalHours: 726.75, estimated: false });
  });

  it("is null while there is nothing fixed and nothing reported, and works with only reports or only fixed days", () => {
    expect(projectTotals({ designDays: null, developmentDays: null }, [])).toMatchObject({ designDays: null, developmentDays: null, spaceHours: 0, fixedHours: 0, totalHours: 0 });
    expect(projectTotals({ designDays: null, developmentDays: null }, [{ minutes: 510, designation: "Shopify Developer" }])).toMatchObject({ designDays: null, developmentDays: 1, totalHours: 8.5 });
    expect(projectTotals({ designDays: 10, developmentDays: null }, [])).toMatchObject({ designDays: 10, developmentDays: null, totalHours: 85 });
  });
});

describe("a single entered total is split by the average ratio", () => {
  const complete = [
    { designDays: 31, developmentDays: 51 },
    { designDays: 22, developmentDays: 36 },
    { designDays: 25, developmentDays: 45 },
  ];

  it("averages design over the projects that have both numbers", () => {
    expect(designShare(complete)).toBeCloseTo(78 / 210, 6);
    expect(designShare([{ designDays: 10, developmentDays: null }])).toBeNull();
  });

  it("splits a lone number as the total duration, and leaves complete or empty ones alone", () => {
    const share = designShare(complete);
    expect(resolveFixed({ designDays: null, developmentDays: 100 }, share)).toEqual({ designDays: 37.14, developmentDays: 62.86, estimated: true });
    expect(resolveFixed({ designDays: 40, developmentDays: null }, share)).toMatchObject({ estimated: true });
    expect(resolveFixed({ designDays: 31, developmentDays: 51 }, share)).toEqual({ designDays: 31, developmentDays: 51, estimated: false });
    expect(resolveFixed({ designDays: null, developmentDays: null }, share)).toEqual({ designDays: null, developmentDays: null, estimated: false });
    expect(resolveFixed({ designDays: null, developmentDays: 100 }, null)).toMatchObject({ estimated: false });
  });

  it("keeps the same total hours after a split and adds the space hours on top of each part", () => {
    const t = projectTotals({ designDays: null, developmentDays: 100 }, [{ minutes: 510, designation: "UI/UX Designer" }], designShare(complete));
    expect(t).toMatchObject({ fixedDesignDays: 37.14, fixedDevelopmentDays: 62.86, designDays: 38.14, developmentDays: 62.86, estimated: true });
    expect(t.fixedHours).toBe(850);
  });
});
