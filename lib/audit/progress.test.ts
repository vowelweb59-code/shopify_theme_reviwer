import { describe, expect, it } from "vitest";
import { AUDIT_STAGES, percentForStage } from "./progress";

describe("percentForStage", () => {
  it("returns 0 for a null stage", () => {
    expect(percentForStage(null)).toBe(0);
  });

  it("returns the stage's fixed anchor for a non-live stage", () => {
    expect(percentForStage("running_rules")).toBe(AUDIT_STAGES.running_rules.percent);
    expect(percentForStage("persisting")).toBe(AUDIT_STAGES.persisting.percent);
  });

  it("returns the checking_live anchor with no stageProgress given", () => {
    expect(percentForStage("checking_live")).toBe(AUDIT_STAGES.checking_live.percent);
  });

  it("interpolates within the checking_live band based on stageProgress", () => {
    const start = percentForStage("checking_live", { completed: 0, total: 10 });
    const half = percentForStage("checking_live", { completed: 5, total: 10 });
    const done = percentForStage("checking_live", { completed: 10, total: 10 });
    expect(start).toBe(AUDIT_STAGES.checking_live.percent);
    expect(half).toBeGreaterThan(start);
    expect(done).toBeGreaterThan(half);
    expect(done).toBeLessThanOrEqual(90);
  });

  it("clamps completed beyond total instead of overshooting the band", () => {
    const over = percentForStage("checking_live", { completed: 15, total: 10 });
    const done = percentForStage("checking_live", { completed: 10, total: 10 });
    expect(over).toBe(done);
  });

  it("falls back to the stage anchor when total is 0", () => {
    expect(percentForStage("checking_live", { completed: 0, total: 0 })).toBe(AUDIT_STAGES.checking_live.percent);
  });
});
