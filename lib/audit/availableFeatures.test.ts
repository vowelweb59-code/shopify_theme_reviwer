import { describe, expect, it } from "vitest";
import { featureStatus, type AvailableFeature } from "./availableFeatures";

function feature(overrides: Partial<AvailableFeature> = {}): AvailableFeature {
  return { id: "test-feature", label: "Test Feature", category: "Test", pointIds: [], ...overrides };
}

describe("featureStatus", () => {
  it("returns not_checked when there's no detector and no Theme Store data", () => {
    expect(featureStatus(feature(), new Map())).toBe("not_checked");
  });

  it("uses the detector's result when pointIds are mapped and ran", () => {
    const f = feature({ pointIds: ["POINT-1"] });
    expect(featureStatus(f, new Map([["POINT-1", true]]))).toBe("detected");
    expect(featureStatus(f, new Map([["POINT-1", false]]))).toBe("not_detected");
  });

  it("never falls back to Theme Store data when the detector already ran (even if it says not_detected)", () => {
    const f = feature({ pointIds: ["POINT-1"], label: "Test Feature" });
    const themeStoreLabels = new Set(["test feature"]);
    expect(featureStatus(f, new Map([["POINT-1", false]]), themeStoreLabels)).toBe("not_detected");
  });

  it("falls back to Theme Store confirmation when there's no detector at all", () => {
    const f = feature({ pointIds: [], label: "Test Feature" });
    const themeStoreLabels = new Set(["test feature"]);
    expect(featureStatus(f, new Map(), themeStoreLabels)).toBe("detected");
  });

  it("matches Theme Store labels case-insensitively", () => {
    const f = feature({ label: "EU Translations" });
    expect(featureStatus(f, new Map(), new Set(["eu translations"]))).toBe("detected");
  });

  it("stays not_checked (never not_detected) when Theme Store data exists but doesn't mention this feature", () => {
    const f = feature({ label: "Some Other Feature" });
    expect(featureStatus(f, new Map(), new Set(["unrelated feature"]))).toBe("not_checked");
  });

  it("falls back to Theme Store data when pointIds are mapped but none of them ran yet", () => {
    const f = feature({ pointIds: ["POINT-NEVER-RAN"], label: "Test Feature" });
    expect(featureStatus(f, new Map(), new Set(["test feature"]))).toBe("detected");
  });
});
