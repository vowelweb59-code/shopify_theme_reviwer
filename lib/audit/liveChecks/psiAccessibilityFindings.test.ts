import { describe, expect, it } from "vitest";
import { contrastFindingsFromPsi, touchTargetFindingsFromPsi } from "./psiAccessibilityFindings";
import type { LighthouseResult } from "../psi";

function lhrWithAudit(auditId: string, items: Array<Record<string, unknown>>): LighthouseResult {
  return { audits: { [auditId]: { score: 0, details: { type: "table", items } } } };
}

describe("contrastFindingsFromPsi", () => {
  it("returns no findings when the color-contrast audit is missing", () => {
    expect(contrastFindingsFromPsi("Demo store", "https://example.com", {})).toEqual([]);
  });

  it("returns no findings when the audit has no failing items", () => {
    const lhr = lhrWithAudit("color-contrast", []);
    expect(contrastFindingsFromPsi("Demo store", "https://example.com", lhr)).toEqual([]);
  });

  it("produces one finding per failing element, using its selector and explanation", () => {
    const lhr = lhrWithAudit("color-contrast", [
      {
        node: {
          selector: "span.hero-title",
          explanation: "Fix any of the following:\n  Element has insufficient color contrast of 1.01 (foreground color: #f5f5f5, background color: #f7f7f7). Expected contrast ratio of 4.5:1",
        },
      },
    ]);
    const findings = contrastFindingsFromPsi("Demo store", "https://example.com", lhr);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "LIVE-CONTRAST-001",
      requirementId: "SHOPIFY-A11Y-004",
      category: "Accessibility",
      severity: "medium",
      presetLabel: "Demo store",
    });
    expect(findings[0].finding).toContain("span.hero-title");
    expect(findings[0].finding).toContain("insufficient color contrast of 1.01");
    expect(findings[0].finding).not.toContain("Fix any of the following");
  });

  it("skips items with no node selector rather than throwing", () => {
    const lhr = lhrWithAudit("color-contrast", [{ subItems: {} }]);
    expect(contrastFindingsFromPsi("Demo store", "https://example.com", lhr)).toEqual([]);
  });

  it("caps the number of findings produced", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ node: { selector: `.item-${i}` } }));
    const lhr = lhrWithAudit("color-contrast", items);
    expect(contrastFindingsFromPsi("Demo store", "https://example.com", lhr).length).toBeLessThan(30);
  });
});

describe("touchTargetFindingsFromPsi", () => {
  it("returns no findings when the target-size audit passed with no items", () => {
    const lhr = lhrWithAudit("target-size", []);
    expect(touchTargetFindingsFromPsi("Demo store", "https://example.com", lhr)).toEqual([]);
  });

  it("produces a finding for each failing element", () => {
    const lhr = lhrWithAudit("target-size", [{ node: { selector: "button.icon-btn", explanation: "Target is 18x18, expected 24x24" } }]);
    const findings = touchTargetFindingsFromPsi("Demo store", "https://example.com", lhr);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("LIVE-A11Y-TOUCH-TARGET-001");
    expect(findings[0].requirementId).toBe("SHOPIFY-A11Y-006");
    expect(findings[0].finding).toContain("button.icon-btn");
  });
});
