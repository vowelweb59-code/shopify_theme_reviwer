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
