import { describe, expect, it } from "vitest";
import { countOutcomes, countRejections, successRate, rejectionCount } from "./rounds";

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
    expect(tally.get("a")?.rejectedIn).toEqual([{ projectId: "p1", name: "Gravity", round: 1, rejectionType: null, weight: 1 }]);
    expect(tally.get("a")?.approvedIn).toEqual([{ projectId: "p1", name: "Gravity", round: 2 }]);
  });

  it("leaves developers out of a round rejected at the design stage", () => {
    const designation = new Map([["dev", "Sr Shopify Developer"], ["pm", "Product Manager"], ["ui", "UI/UX Designer"]]);
    const tally = countOutcomes([{ status: "live", members: [m("dev"), m("pm")], rounds: [{ status: "rejected", rejectionStage: "design", members: [m("dev"), m("pm"), m("ui")] }] }], designation);
    expect(tally.get("dev")).toMatchObject({ approved: 1, rejected: 0 });
    expect(tally.get("pm")).toMatchObject({ approved: 1, rejected: 1 });
    expect(tally.get("ui")).toMatchObject({ approved: 0, rejected: 1 });
  });

  it("counts the current round only for people who reported time on the theme, except managers; earlier rounds count everyone", () => {
    const designation = new Map([["dev", "Shopify Developer"], ["other", "Shopify Developer"], ["pm", "Product Manager"]]);
    const projects = [{ themeId: "t1", status: "live", members: [m("dev"), m("other"), m("pm")], rounds: [{ status: "rejected", members: [m("dev"), m("other"), m("pm")] }] }];
    const worked = { themesWithReports: new Set(["t1"]), byTheme: new Map([["t1", new Set(["dev"])]]) };
    const tally = countOutcomes(projects, designation, worked);
    expect(tally.get("dev")).toMatchObject({ approved: 1, rejected: 1 });
    expect(tally.get("other")).toMatchObject({ approved: 0, rejected: 1 }); // on the earlier round, but not the current (approved) one
    expect(tally.get("pm")).toMatchObject({ approved: 1, rejected: 1 });
    // A theme nobody has reported on yet keeps counting everyone.
    expect(countOutcomes(projects, designation, { themesWithReports: new Set(), byTheme: new Map() }).get("other")).toMatchObject({ approved: 1, rejected: 1 });
  });
});

describe("rejection types and the Team Lead weighting", () => {
  const lead = { memberId: "lead", role: "Team Lead" };
  const dev = { memberId: "dev", role: null };
  const project = (type: "internal" | "shopify" | null) => [{ _id: "p", name: "Soft", status: "live", members: [lead, dev], rounds: [{ status: "rejected", rejectionType: type, members: [lead, dev] }] }];
  const designations = new Map([["dev", "Shopify Developer"], ["lead", "Sr Shopify Developer"]]);

  it("counts an internal rejection at half for a Team Lead and in full for everyone else", () => {
    const tally = countOutcomes(project("internal"), designations);
    expect(tally.get("lead")).toMatchObject({ approved: 1, rejected: 1, rejectedWeight: 0.5 });
    expect(tally.get("dev")).toMatchObject({ approved: 1, rejected: 1, rejectedWeight: 1 });
    expect(successRate(tally.get("lead"))).toBe(67); // 1 / (1 + 0.5)
    expect(successRate(tally.get("dev"))).toBe(50);
  });
  it("counts a rejection by Shopify in full for everyone, the Team Lead too", () => {
    const tally = countOutcomes(project("shopify"), designations);
    expect(tally.get("lead")?.rejectedWeight).toBe(1);
    expect(successRate(tally.get("lead"))).toBe(50);
  });
  it("counts a rejection with no type in full (rows from before types existed)", () => {
    expect(countOutcomes(project(null), designations).get("lead")?.rejectedWeight).toBe(1);
  });
  it("recognises a Team Lead by designation as well as by role on the round", () => {
    const byDesignation = countOutcomes(project("internal"), new Map([["dev", "Team Lead"]]));
    expect(byDesignation.get("dev")?.rejectedWeight).toBe(0.5);
  });
  it("still leaves a design-stage rejection out of a developer's rate, and says which kind each rejection was", () => {
    const tally = countOutcomes(
      [{ _id: "p", name: "Soft", status: "live", members: [dev], rounds: [{ status: "rejected", rejectionStage: "design", rejectionType: "shopify", members: [dev] }, { status: "rejected", rejectionType: "internal", members: [dev] }] }],
      designations
    );
    expect(tally.get("dev")).toMatchObject({ approved: 1, rejected: 1 });
    expect(tally.get("dev")?.rejectedIn).toEqual([{ projectId: "p", name: "Soft", round: 2, rejectionType: "internal", weight: 1 }]);
  });
  it("successRate works from plain counts when no weight is given", () => {
    expect(successRate({ approved: 3, rejected: 1 })).toBe(75);
    expect(successRate({ approved: 1, rejected: 2, rejectedWeight: 1 })).toBe(50);
  });
});
