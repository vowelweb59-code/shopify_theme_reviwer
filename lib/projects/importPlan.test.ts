import { describe, expect, it } from "vitest";
import { buildPlan, parseProjectLabel, type ExistingState, type ImportData } from "./importPlan";

describe("parseProjectLabel", () => {
  it("reads the spellings used in the sheet", () => {
    expect(parseProjectLabel("Voltix version 1")).toEqual({ theme: "Voltix", version: 1 });
    expect(parseProjectLabel("Velocity 1")).toEqual({ theme: "Velocity", version: 1 });
    expect(parseProjectLabel("Apollo Vesion 2")).toEqual({ theme: "Apollo", version: 2 });
    expect(parseProjectLabel("Aspire")).toEqual({ theme: "Aspire", version: null });
    expect(parseProjectLabel("Zeal Half")).toEqual({ theme: "Zeal Half", version: null });
    expect(parseProjectLabel("kombat")).toEqual({ theme: "kombat", version: null });
  });
});

const data: ImportData = {
  people: { Ann: "Ann Lee", Bob: "Bob Ray", Cy: "Cy Dole" },
  newMembers: [{ name: "Cy Dole", designation: "UI/UX Designer" }],
  themeAliases: { "alpha half": "Alpha" },
  statusMap: { Live: "live", "Under Designing": "under_designing" },
  themes: [
    { portal: "P1", theme: "Alpha", rejections: 1, status: "Live", developmentDays: 40, designDays: 10, designers: ["Ann"], developers: ["Bob"] },
    { portal: "P2", theme: "Beta", rejections: null, status: "Under Designing", developmentDays: null, designDays: null, designers: ["Cy"], developers: [] },
  ],
  assignments: [
    { role: "designer", person: "Ann", projects: ["Alpha 1"] },
    { role: "developer", person: "Bob", projects: ["Alpha"] },
    { role: "manager", person: "Ann", projects: ["Alpha Half", "Alpha 2", "Unlisted"] },
  ],
};
const existing: ExistingState = { themes: ["Alpha"], members: ["Ann Lee", "Bob Ray"], projects: [] };

describe("buildPlan", () => {
  it("makes a project per version: earlier ones Rejected, the latest takes the table's status and days", () => {
    const plan = buildPlan(data, existing);
    const alpha = plan.creates.filter((c) => c.themeName === "Alpha");
    expect(alpha.map((c) => [c.name, c.status, c.developmentDays])).toEqual([
      ["Alpha 1", "rejected", null],
      ["Alpha 2", "live", 40],
    ]);
  });

  it("applies a number-less name to every version and falls back to the table for an empty role on the latest", () => {
    const [v1, v2] = buildPlan(data, existing).creates;
    expect(v1.memberNames).toEqual(["Ann Lee", "Bob Ray"]); // designer list + bare developer + bare manager (same person)
    expect(v2.memberNames).toEqual(["Bob Ray", "Ann Lee"]); // bare developer, then the bare manager; the table's designer (Ann) is already on it
  });

  it("names a theme without versions after the theme, and creates missing themes and members", () => {
    const plan = buildPlan(data, existing);
    expect(plan.creates.find((c) => c.themeName === "Beta")).toMatchObject({ name: "Beta", status: "under_designing", memberNames: ["Cy Dole"] });
    expect(plan.newThemes).toEqual(["Beta"]);
    expect(plan.newMembers).toEqual([{ name: "Cy Dole", designation: "UI/UX Designer" }]);
  });

  it("skips names that have no main-table row", () => {
    expect(buildPlan(data, existing).skipped.join()).toContain("Unlisted");
  });

  it("only fills gaps in an existing project and never duplicates or overwrites", () => {
    const withExisting: ExistingState = {
      ...existing,
      projects: [{ name: "alpha version 2", portal: null, themeName: "Alpha", status: "under_development", designDays: null, developmentDays: 99, description: "", memberNames: ["Bob Ray"] }],
    };
    const plan = buildPlan(data, withExisting);
    expect(plan.creates.map((c) => c.name)).toEqual(["Alpha 1", "Beta"]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].set).toEqual({ name: "Alpha 2", portal: "P1", designDays: 10, description: "Portal: P1. Rejections on this theme: 1." });
    expect(plan.updates[0].addMembers).toEqual(["Ann Lee"]);
    expect(plan.updates[0].notes.join()).toContain("status stays under_development");
    expect(plan.updates[0].notes.join()).toContain("developmentDays stays 99");
  });
});
