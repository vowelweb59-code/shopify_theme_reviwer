import { describe, expect, it } from "vitest";
import { detectBuildStatus } from "./buildStatus";

describe("detectBuildStatus", () => {
  it("is Under Designing while only designers have reported", () => {
    expect(detectBuildStatus("planning", ["UI/UX Designer", "UI/UX Designer"])).toBe("under_designing");
    expect(detectBuildStatus("under_designing", ["UI/UX Designer"])).toBeNull(); // already right
  });

  it("is Under Development once a developer has reported, from Planning or Under Designing", () => {
    expect(detectBuildStatus("under_designing", ["UI/UX Designer", "Shopify Developer"])).toBe("under_development");
    expect(detectBuildStatus("planning", ["Sr Shopify Developer"])).toBe("under_development");
  });

  it("ignores Product Managers, and does nothing when nobody has reported", () => {
    expect(detectBuildStatus("planning", ["Product Manager"])).toBeNull();
    expect(detectBuildStatus("under_designing", ["Product Manager", "UI/UX Designer"])).toBeNull();
    expect(detectBuildStatus("planning", [])).toBeNull();
    expect(detectBuildStatus("planning", [null, undefined])).toBeNull();
  });

  it("never moves a project the owner has taken further, or backwards", () => {
    for (const status of ["under_development", "design_completed", "theme_uploaded", "under_review", "error_given", "live", "rejected", "completed", null]) {
      expect(detectBuildStatus(status, ["UI/UX Designer", "Shopify Developer"])).toBeNull();
    }
  });
});
