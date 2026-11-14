import { describe, expect, it } from "vitest";
import { detectReviewStatus, storeNameMatchesTheme } from "./reviewStatus";

describe("storeNameMatchesTheme", () => {
  it("matches the whole name or the theme as the first words, ignoring case and punctuation", () => {
    expect(storeNameMatchesTheme("Apollo", "Apollo")).toBe(true);
    expect(storeNameMatchesTheme("apollo 1.0.0", "Apollo")).toBe(true);
    expect(storeNameMatchesTheme("Apollo - Gaming Theme", "Apollo")).toBe(true);
    expect(storeNameMatchesTheme("Home Décor", "Home Décor")).toBe(true);
  });
  it("does not match a different theme that merely starts the same", () => {
    expect(storeNameMatchesTheme("Automobile", "Auto")).toBe(false);
    expect(storeNameMatchesTheme("Apolloni", "Apollo")).toBe(false);
    expect(storeNameMatchesTheme("The Apollo", "Apollo")).toBe(false);
    expect(storeNameMatchesTheme(null, "Apollo")).toBe(false);
    expect(storeNameMatchesTheme("Apollo", "")).toBe(false);
  });
});

describe("detectReviewStatus", () => {
  it("is Under Review once the theme is on an ops store", () => {
    for (const status of ["planning", "under_designing", "design_completed", "under_development", "theme_uploaded"]) {
      expect(detectReviewStatus(status, { onOpsStore: true, listed: false })).toBe("under_review");
    }
  });

  it("is Live once the theme is on the public Theme Store, even if it was never seen on an ops store", () => {
    for (const status of ["theme_uploaded", "under_review", "error_given", "under_development"]) {
      expect(detectReviewStatus(status, { onOpsStore: true, listed: true })).toBe("live");
      expect(detectReviewStatus(status, { onOpsStore: false, listed: true })).toBe("live");
    }
  });

  it("leaves Error Given alone while the theme is only on an ops store, and never touches the owner's later or closed statuses", () => {
    expect(detectReviewStatus("error_given", { onOpsStore: true, listed: false })).toBeNull();
    expect(detectReviewStatus("under_review", { onOpsStore: true, listed: false })).toBeNull();
    for (const status of ["live", "rejected", "active", "on_hold", "completed", null]) {
      expect(detectReviewStatus(status, { onOpsStore: true, listed: true })).toBeNull();
    }
  });

  it("does nothing for a theme seen nowhere", () => {
    expect(detectReviewStatus("theme_uploaded", { onOpsStore: false, listed: false })).toBeNull();
  });
});
