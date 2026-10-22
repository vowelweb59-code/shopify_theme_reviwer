import { describe, expect, it } from "vitest";
import { countOutcomes, countRejections, successRate, planMerge, rejectionCount, splitVersionName, type MergeInput } from "./rounds";

const m = (id: string) => ({ memberId: id, role: null });

describe("countRejections", () => {
  it("counts each rejected round, earlier and current, for everyone on it", () => {
    const counts = countRejections([
      { status: "live", members: [m("a"), m("b")], rounds: [{ status: "rejected", members: [m("a")] }, { status: "rejected", members: [m("a"), m("c")] }] },
      { status: "rejected", members: [m("b")] },
      { status: "under_review", members: [m("c")] },
    ]);
    expect(Object.fromEntries(counts)).toEqual({ a: 2, c: 1, b: 1 });
  });
});

describe("rejectionCount", () => {
  it("adds the current round when it is rejected", () => {
    expect(rejectionCount({ status: "live", rounds: [{ status: "rejected" }] })).toBe(1);
    expect(rejectionCount({ status: "rejected", rounds: [{ status: "rejected" }] })).toBe(2);
    expect(rejectionCount({ status: "live" })).toBe(0);
  });
});

describe("splitVersionName", () => {
  it("reads the version suffix", () => {
    expect(splitVersionName("Voltix 2")).toEqual({ base: "Voltix", version: 2 });
    expect(splitVersionName("Voltix Version 3")).toEqual({ base: "Voltix", version: 3 });
    expect(splitVersionName("Zeal Half")).toEqual({ base: "Zeal Half", version: null });
    expect(splitVersionName("7")).toEqual({ base: "7", version: null });
  });
});

const project = (over: Partial<MergeInput>): MergeInput => ({
  id: "x", themeId: "t1", portal: "P1", type: "theme_development", name: "Voltix", status: "rejected",
  designDays: null, developmentDays: null, description: "", members: [], createdAt: 0, ...over,
});

describe("planMerge", () => {
  it("folds earlier versions into rounds of the latest, ordered by version number", () => {
    const plan = planMerge([
      project({ id: "v3", name: "Voltix 3", status: "live", createdAt: 1 }),
      project({ id: "v1", name: "Voltix 1", members: [m("a")], description: "bad images", createdAt: 3 }),
      project({ id: "v2", name: "Voltix 2", designDays: 4, createdAt: 2 }),
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ keepId: "v3", name: "Voltix", removeIds: ["v1", "v2"] });
    expect(plan[0].rounds.map((r) => [r.status, r.designDays, r.note])).toEqual([["rejected", null, "bad images"], ["rejected", 4, ""]]);
    expect(plan[0].rounds[0].members).toEqual([m("a")]);
  });

  it("leaves lone projects, other portals, other types and Theme Update projects alone", () => {
    expect(
      planMerge([
        project({ id: "a", name: "Alpha 1" }),
        project({ id: "b", name: "Alpha 2", portal: "P2" }),
        project({ id: "c", name: "Alpha 3", type: "preset_development" }),
        project({ id: "d", name: "Alpha 4", type: "theme_update" }),
        project({ id: "e", name: "Alpha 5", type: "theme_update" }),
      ])
    ).toEqual([]);
  });

  it("does not merge differently named products that share a theme record", () => {
    expect(planMerge([project({ id: "a", name: "Adorn 1", createdAt: 1 }), project({ id: "b", name: "Flaunt", createdAt: 2 }), project({ id: "c", name: "Dynamic", createdAt: 3 })])).toEqual([]);
  });

  it("merges an unnumbered project with its numbered versions, newest last", () => {
    const plan = planMerge([project({ id: "a", name: "Voltix", createdAt: 1 }), project({ id: "b", name: "Voltix 2", createdAt: 2 })]);
    expect(plan[0]).toMatchObject({ keepId: "b", name: "Voltix", removeIds: ["a"] });
  });
});

describe("countOutcomes / successRate", () => {
  it("tallies Live and Rejected rounds per member and ignores rounds in progress", () => {
    const tally = countOutcomes([
      { status: "live", members: [m("a"), m("b")], rounds: [{ status: "rejected", members: [m("a")] }] },
      { status: "under_review", members: [m("a")] },
    ]);
    expect(tally.get("a")).toMatchObject({ approved: 1, rejected: 1 });
    expect(tally.get("b")).toMatchObject({ approved: 1, rejected: 0 });
    expect(successRate(tally.get("a"))).toBe(50);
    expect(successRate(tally.get("b"))).toBe(100);
    expect(successRate(undefined)).toBeNull();
  });

  it("names the project (and round, when it has several) for each decided round", () => {
    const tally = countOutcomes([{ _id: "p1", name: "Gravity", status: "live", members: [m("a")], rounds: [{ status: "rejected", members: [m("a")] }] }]);
    expect(tally.get("a")?.rejectedIn).toEqual([{ projectId: "p1", name: "Gravity", round: 1 }]);
    expect(tally.get("a")?.approvedIn).toEqual([{ projectId: "p1", name: "Gravity", round: 2 }]);
  });
});
