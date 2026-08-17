import { describe, expect, it } from "vitest";
import { computeReadiness } from "./readiness";

describe("computeReadiness", () => {
  it("is READY with no blockers and sufficient coverage", () => {
    expect(computeReadiness([{ severity: "medium" }], 80).status).toBe("READY");
  });

  it("is NOT_READY when an unresolved blocker exists, even with full coverage", () => {
    const result = computeReadiness([{ severity: "blocker", status: "open" }], 100);
    expect(result.status).toBe("NOT_READY");
  });

  it("treats a finding with no status field at all as open (pre-migration data)", () => {
    const result = computeReadiness([{ severity: "blocker" }], 100);
    expect(result.status).toBe("NOT_READY");
  });

  it("does not count a resolved blocker against readiness", () => {
    const result = computeReadiness([{ severity: "blocker", status: "resolved" }], 100);
    expect(result.status).toBe("READY");
  });

  it("does not count an ignored blocker against readiness", () => {
    const result = computeReadiness([{ severity: "blocker", status: "ignored" }], 100);
    expect(result.status).toBe("READY");
  });

  it("is INCOMPLETE when there are no blockers but coverage is too low", () => {
    const result = computeReadiness([{ severity: "low" }], 40);
    expect(result.status).toBe("INCOMPLETE");
  });

  it("prefers NOT_READY over INCOMPLETE when both conditions are true", () => {
    const result = computeReadiness([{ severity: "blocker", status: "open" }], 10);
    expect(result.status).toBe("NOT_READY");
  });

  it("is READY with zero findings and sufficient coverage", () => {
    expect(computeReadiness([], 90).status).toBe("READY");
  });

  it("treats a high-severity finding as a blocker when configured to", () => {
    const result = computeReadiness([{ severity: "high", status: "open" }], 100, {
      blockerSeverities: ["blocker", "high"],
      minimumCoveragePercent: 70,
    });
    expect(result.status).toBe("NOT_READY");
  });

  it("does not treat a high-severity finding as a blocker under the default config", () => {
    const result = computeReadiness([{ severity: "high", status: "open" }], 100);
    expect(result.status).toBe("READY");
  });

  it("respects a custom, lower minimum coverage threshold", () => {
    const result = computeReadiness([], 50, { blockerSeverities: ["blocker"], minimumCoveragePercent: 40 });
    expect(result.status).toBe("READY");
  });

  it("respects a custom, higher minimum coverage threshold", () => {
    const result = computeReadiness([], 80, { blockerSeverities: ["blocker"], minimumCoveragePercent: 90 });
    expect(result.status).toBe("INCOMPLETE");
  });
});
