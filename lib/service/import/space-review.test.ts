import { describe, expect, it } from "vitest";
import { parseSpaceReview } from "./space-review";

const base = {
  space: "spaces/X",
  reviewedAt: "2026-11-26",
  tasks: [{ group: "older", text: "Send the memo", who: "Himanshi" }],
  opportunities: [{ priority: "High", title: "Retainer", pitch: "Monthly" }],
};

describe("parseSpaceReview", () => {
  it("reads a valid file and fills the optional fields with null", () => {
    const r = parseSpaceReview(base);
    expect(r.tasks[0]).toMatchObject({ group: "older", text: "Send the memo", who: "Himanshi", asked: null, threads: null });
    expect(r.opportunities[0].evidence).toBeNull();
    expect(r.notes).toEqual([]);
  });

  it("names the first bad field", () => {
    expect(() => parseSpaceReview({ ...base, tasks: [{ group: "now", text: "x" }] })).toThrow("tasks[0].group");
    expect(() => parseSpaceReview({ ...base, opportunities: [{ priority: "Huge", title: "x" }] })).toThrow("opportunities[0].priority");
    expect(() => parseSpaceReview({ ...base, reviewedAt: "soon" })).toThrow("reviewedAt");
    expect(() => parseSpaceReview({ ...base, tasks: [{ group: "older" }] })).toThrow("tasks[0].text is required");
  });
});

describe("parseSpaceReview health and risk", () => {
  const base = {
    space: "spaces/X",
    reviewedAt: "2026-11-28",
    tasks: [
      { group: "older", text: "Send the memo", risk: true },
      { group: "older", text: "Other" },
    ],
    opportunities: [],
  };

  it("reads the health and the per-task risk flag, defaulting both", () => {
    const r = parseSpaceReview({ ...base, health: { level: "red", reasons: [{ text: "Client threatened to leave", threads: "T4" }] } });
    expect(r.health).toEqual({ level: "red", reasons: [{ text: "Client threatened to leave", threads: "T4" }] });
    expect(r.tasks.map((t) => t.risk)).toEqual([true, false]);
    expect(parseSpaceReview(base).health).toBeNull();
  });

  it("needs reasons for watch or red, none for ok, and a valid level", () => {
    expect(() => parseSpaceReview({ ...base, health: { level: "red", reasons: [] } })).toThrow("health.reasons");
    expect(() => parseSpaceReview({ ...base, health: { level: "bad", reasons: [] } })).toThrow("health.level");
    expect(parseSpaceReview({ ...base, health: { level: "ok", reasons: [{ text: "ignored" }] } }).health).toEqual({ level: "ok", reasons: [] });
  });
});
