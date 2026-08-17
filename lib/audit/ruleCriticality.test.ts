import { describe, expect, it } from "vitest";
import { computeRuleCriticality } from "./ruleCriticality";

describe("computeRuleCriticality", () => {
  it("marks a blocker-severity Theme Store Compliance rule as critical", () => {
    expect(computeRuleCriticality("Theme Store Compliance", "blocker")).toBe("critical");
  });

  it("marks a high-severity Theme Store Compliance rule as critical", () => {
    expect(computeRuleCriticality("Theme Store Compliance", "high")).toBe("critical");
  });

  it("marks a medium-severity Theme Store Compliance rule as informational, not critical", () => {
    expect(computeRuleCriticality("Theme Store Compliance", "medium")).toBe("informational");
  });

  it("marks a blocker-severity rule in any other category as important, not critical", () => {
    expect(computeRuleCriticality("Bug", "blocker")).toBe("important");
  });

  it("marks a medium-severity Accessibility rule as important", () => {
    expect(computeRuleCriticality("Accessibility", "medium")).toBe("important");
  });

  it("marks a medium-severity Technical SEO rule as important", () => {
    expect(computeRuleCriticality("Technical SEO", "medium")).toBe("important");
  });

  it("marks a medium-severity Bug rule as informational", () => {
    expect(computeRuleCriticality("Bug", "medium")).toBe("informational");
  });

  it("marks a low-severity rule as informational regardless of category", () => {
    expect(computeRuleCriticality("Theme Store Compliance", "low")).toBe("informational");
  });
});
