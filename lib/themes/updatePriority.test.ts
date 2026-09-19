import { describe, expect, it } from "vitest";
import { computeUpdatePriority } from "./updatePriority";

const NOW = new Date("2026-09-19T00:00:00Z");

describe("computeUpdatePriority", () => {
  it("returns a null score when there's no data at all", () => {
    const result = computeUpdatePriority(
      { themeStoreVersionReleasedAt: null, featuresScore: null, desktopPerformanceScore: null, mobilePerformanceScore: null, opportunitiesScore: null },
      NOW
    );
    expect(result.score).toBeNull();
    expect(result.daysSinceUpdate).toBeNull();
  });

  it("scores a fresh, fully-covered theme as low urgency", () => {
    const result = computeUpdatePriority(
      {
        themeStoreVersionReleasedAt: new Date("2026-09-18T00:00:00Z"),
        featuresScore: 100,
        desktopPerformanceScore: 100,
        mobilePerformanceScore: 100,
        opportunitiesScore: 100,
      },
      NOW
    );
    expect(result.daysSinceUpdate).toBe(1);
    expect(result.score).toBe(0);
  });

  it("scores a stale, poorly-covered theme as high urgency", () => {
    const result = computeUpdatePriority(
      {
        themeStoreVersionReleasedAt: new Date("2025-01-01T00:00:00Z"), // well past the 180-day saturation point
        featuresScore: 0,
        desktopPerformanceScore: 0,
        mobilePerformanceScore: 0,
        opportunitiesScore: 0,
      },
      NOW
    );
    expect(result.score).toBe(100);
  });

  it("weights days at 40%, features 30%, Core Web Vitals 20%, opportunities 10%", () => {
    // Only the days signal is present — its full 100% urgency contribution
    // should carry through undiluted once weights are renormalized to the
    // single available component.
    const daysOnly = computeUpdatePriority(
      { themeStoreVersionReleasedAt: new Date("2025-01-01T00:00:00Z"), featuresScore: null, desktopPerformanceScore: null, mobilePerformanceScore: null, opportunitiesScore: null },
      NOW
    );
    expect(daysOnly.score).toBe(100);

    // With every signal present and evenly split between 0 and 100 urgency,
    // renormalization is a no-op (weights already sum to 1) — expect the
    // literal weighted average.
    const mixed = computeUpdatePriority(
      {
        themeStoreVersionReleasedAt: new Date("2025-01-01T00:00:00Z"), // 100 urgency (40%)
        featuresScore: 100, // 0 urgency (30%)
        desktopPerformanceScore: 100,
        mobilePerformanceScore: 100, // 0 urgency (20%)
        opportunitiesScore: 100, // 0 urgency (10%)
      },
      NOW
    );
    expect(mixed.score).toBe(40);
  });

  it("averages desktop and mobile performance for the Core Web Vitals component", () => {
    const result = computeUpdatePriority(
      { themeStoreVersionReleasedAt: null, featuresScore: null, desktopPerformanceScore: 100, mobilePerformanceScore: 0, opportunitiesScore: null },
      NOW
    );
    // Average CWV score is 50 -> urgency 50, sole component -> score 50.
    expect(result.score).toBe(50);
  });

  it("renormalizes weights across whatever signals are available", () => {
    // Only features (30%) and opportunities (10%) available: renormalized
    // to 75%/25% of the total, both at 0 urgency (full coverage) -> 0.
    const result = computeUpdatePriority(
      { themeStoreVersionReleasedAt: null, featuresScore: 100, desktopPerformanceScore: null, mobilePerformanceScore: null, opportunitiesScore: 100 },
      NOW
    );
    expect(result.score).toBe(0);
  });
});
