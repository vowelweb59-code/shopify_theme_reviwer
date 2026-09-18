import { afterEach, describe, expect, it } from "vitest";
import {
  extractCoreMetrics,
  extractOpportunityFindings,
  psiThresholdFindings,
  runPageSpeedChecksForPresets,
  shopifySubmissionBarFindings,
  type PageSpeedMetric,
} from "./pageSpeed";
import type { LighthouseAudit, LighthouseAuditRef, LighthouseResult } from "./psi";

function metric(overrides: Partial<PageSpeedMetric> = {}): PageSpeedMetric {
  return { label: "Demo store", url: "https://example.com", pageType: "home", strategy: "mobile", ...overrides };
}

describe("runPageSpeedChecksForPresets — missing API key", () => {
  const originalEnv = process.env.PAGESPEED_API_KEY;
  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalEnv;
  });

  it("reports one clear per-preset error instead of attempting any PSI calls", async () => {
    delete process.env.PAGESPEED_API_KEY;
    const presets = [
      { label: "A", url: "https://a.example.com" },
      { label: "B", url: "https://b.example.com" },
    ];
    const result = await runPageSpeedChecksForPresets(presets);
    expect(result.metrics).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      { label: "A", url: "https://a.example.com", error: "PAGESPEED_API_KEY is not configured on the server." },
      { label: "B", url: "https://b.example.com", error: "PAGESPEED_API_KEY is not configured on the server." },
    ]);
  });
});

describe("psiThresholdFindings", () => {
  it("flags nothing for a fully 'good' set of metrics", () => {
    const findings = psiThresholdFindings("Demo store", "https://example.com", {
      performanceScore: 95,
      lcpMs: 2000,
      clsScore: 0.05,
      tbtMs: 100,
    });
    expect(findings).toHaveLength(0);
  });

  it("flags a 'needs improvement' performance score as medium", () => {
    const findings = psiThresholdFindings("Demo store", "https://example.com", { performanceScore: 75 });
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("LIVE-PERF-SCORE-001");
    expect(findings[0].severity).toBe("medium");
  });

  it("flags a 'poor' performance score as high", () => {
    const findings = psiThresholdFindings("Demo store", "https://example.com", { performanceScore: 30 });
    expect(findings[0].severity).toBe("high");
  });

  it("flags LCP over 4s as high, and the 2.5-4s range as medium", () => {
    expect(psiThresholdFindings("d", "u", { lcpMs: 4500 })[0].severity).toBe("high");
    expect(psiThresholdFindings("d", "u", { lcpMs: 3000 })[0].severity).toBe("medium");
    expect(psiThresholdFindings("d", "u", { lcpMs: 2000 })).toHaveLength(0);
  });

  it("flags CLS over 0.25 as high, and the 0.1-0.25 range as medium", () => {
    expect(psiThresholdFindings("d", "u", { clsScore: 0.3 })[0].severity).toBe("high");
    expect(psiThresholdFindings("d", "u", { clsScore: 0.15 })[0].severity).toBe("medium");
    expect(psiThresholdFindings("d", "u", { clsScore: 0.05 })).toHaveLength(0);
  });

  it("flags TBT over 600ms as high, and the 200-600ms range as medium", () => {
    expect(psiThresholdFindings("d", "u", { tbtMs: 700 })[0].severity).toBe("high");
    expect(psiThresholdFindings("d", "u", { tbtMs: 400 })[0].severity).toBe("medium");
    expect(psiThresholdFindings("d", "u", { tbtMs: 100 })).toHaveLength(0);
  });

  it("never produces a blocker-severity finding — this check is advisory, not a hard rule", () => {
    const findings = psiThresholdFindings("d", "u", { performanceScore: 0, lcpMs: 99999, clsScore: 1, tbtMs: 99999 });
    expect(findings.every((f) => f.severity !== "blocker")).toBe(true);
  });
});

describe("extractCoreMetrics", () => {
  it("pulls the 4 headline numbers out of a full Lighthouse result", () => {
    const lhr: LighthouseResult = {
      categories: { performance: { score: 0.87 } },
      audits: {
        "largest-contentful-paint": { score: 0.8, numericValue: 2100 },
        "cumulative-layout-shift": { score: 1, numericValue: 0.03 },
        "total-blocking-time": { score: 0.9, numericValue: 150 },
      },
    };
    expect(extractCoreMetrics(lhr)).toEqual({ performanceScore: 87, lcpMs: 2100, clsScore: 0.03, tbtMs: 150 });
  });

  it("returns all-undefined for an empty result rather than throwing", () => {
    expect(extractCoreMetrics({})).toEqual({
      performanceScore: undefined,
      lcpMs: undefined,
      clsScore: undefined,
      tbtMs: undefined,
    });
  });
});

describe("extractOpportunityFindings", () => {
  function lhrWith(audits: Record<string, LighthouseAudit>, auditRefs: LighthouseAuditRef[]): LighthouseResult {
    return { audits, categories: { performance: { auditRefs } } };
  }

  it("flags a failing render-blocking-resources opportunity, using Lighthouse's own title/description/savings", () => {
    const lhr = lhrWith(
      {
        "render-blocking-resources": {
          score: 0.3,
          scoreDisplayMode: "numeric",
          title: "Eliminate render-blocking resources",
          description: "Resources are blocking the first paint. [Learn more](https://web.dev/render-blocking-resources/).",
          displayValue: "Potential savings of 570 ms",
          details: { type: "opportunity", overallSavingsMs: 570, items: [{ url: "https://example.com/widget.js", wastedMs: 570 }] },
        },
      },
      [{ id: "render-blocking-resources", group: "load-opportunities" }]
    );

    const findings = extractOpportunityFindings("Demo store", "https://example.com", lhr);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "LIVE-PERF-LH-RENDER-BLOCKING-RESOURCES",
      requirementId: "PERF-BP-008",
      category: "Performance",
      severity: "high",
      presetLabel: "Demo store",
      sourceUrl: "https://web.dev/render-blocking-resources/",
    });
    expect(findings[0].finding).toContain("Eliminate render-blocking resources");
    expect(findings[0].finding).toContain("Potential savings of 570 ms");
    expect(findings[0].finding).toContain("widget.js");
    expect(findings[0].recommendation).not.toContain("[Learn more]");
    expect(findings[0].recommendation).toContain("Resources are blocking the first paint.");
  });

  it("uses medium severity for a 0.5-0.89 scoring audit", () => {
    const lhr = lhrWith(
      { "unminified-css": { score: 0.7, scoreDisplayMode: "numeric", title: "Minify CSS", description: "d" } },
      [{ id: "unminified-css", group: "load-opportunities" }]
    );
    expect(extractOpportunityFindings("d", "u", lhr)[0].severity).toBe("medium");
  });

  it("skips a passing audit (score >= 0.9)", () => {
    const lhr = lhrWith(
      { "unminified-css": { score: 1, scoreDisplayMode: "numeric", title: "Minify CSS", description: "d" } },
      [{ id: "unminified-css", group: "load-opportunities" }]
    );
    expect(extractOpportunityFindings("d", "u", lhr)).toHaveLength(0);
  });

  it("skips an informative-only audit even if it has no score", () => {
    const lhr = lhrWith(
      { "network-requests": { score: null, scoreDisplayMode: "informative", title: "Network requests", description: "d" } },
      [{ id: "network-requests", group: "diagnostics" }]
    );
    expect(extractOpportunityFindings("d", "u", lhr)).toHaveLength(0);
  });

  it("skips audits outside the load-opportunities/diagnostics groups (e.g. the 'metrics' group, already covered elsewhere)", () => {
    const lhr = lhrWith(
      { "largest-contentful-paint": { score: 0.2, scoreDisplayMode: "numeric", title: "LCP", description: "d" } },
      [{ id: "largest-contentful-paint", group: "metrics" }]
    );
    expect(extractOpportunityFindings("d", "u", lhr)).toHaveLength(0);
  });

  it("never produces a blocker-severity finding — this is advisory, not a hard rule", () => {
    const lhr = lhrWith(
      { "unminified-css": { score: 0, scoreDisplayMode: "numeric", title: "Minify CSS", description: "d" } },
      [{ id: "unminified-css", group: "load-opportunities" }]
    );
    expect(extractOpportunityFindings("d", "u", lhr)[0].severity).not.toBe("blocker");
  });

  it("returns an empty array for a result with no auditRefs, rather than throwing", () => {
    expect(extractOpportunityFindings("d", "u", {})).toEqual([]);
  });

  // Current Lighthouse versions group most of these audits under
  // "insights" (not "load-opportunities") and score most of them with
  // "metricSavings" rather than "numeric"/"binary" — confirmed against a
  // real PageSpeed Insights response where every actionable, 0-scoring
  // audit used exactly this shape and none used the older one. Missing
  // either check here previously meant a real performance score in the
  // 50s-60s produced zero opportunity findings.
  it("flags a failing 'insights'-group, 'metricSavings'-display audit (current real Lighthouse shape)", () => {
    const lhr = lhrWith(
      {
        "render-blocking-insight": {
          score: 0,
          scoreDisplayMode: "metricSavings",
          title: "Render-blocking requests",
          description: "Requests are blocking the page's initial render.",
          displayValue: "Est savings of 590 ms",
          details: { type: "table", items: [{ url: "https://example.com/swiper.js", wastedMs: 967, totalBytes: 40610 }] },
        },
      },
      [{ id: "render-blocking-insight", group: "insights" }]
    );
    const findings = extractOpportunityFindings("Demo store", "https://example.com", lhr);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("LIVE-PERF-LH-RENDER-BLOCKING-INSIGHT");
    expect(findings[0].finding).toContain("swiper.js");
  });

  it("skips an 'insights'-group audit with an unrecognized scoreDisplayMode (e.g. informative)", () => {
    const lhr = lhrWith(
      { "dom-size-insight": { score: 1, scoreDisplayMode: "informative", title: "Optimize DOM size", description: "d" } },
      [{ id: "dom-size-insight", group: "insights" }]
    );
    expect(extractOpportunityFindings("d", "u", lhr)).toHaveLength(0);
  });
});

describe("extractCoreMetrics — accessibility", () => {
  it("extracts accessibilityScore when the accessibility category is present", () => {
    const lhr: LighthouseResult = { categories: { performance: { score: 0.8 }, accessibility: { score: 0.95 } } };
    expect(extractCoreMetrics(lhr).accessibilityScore).toBe(95);
  });

  it("leaves accessibilityScore undefined when the category wasn't requested", () => {
    const lhr: LighthouseResult = { categories: { performance: { score: 0.8 } } };
    expect(extractCoreMetrics(lhr).accessibilityScore).toBeUndefined();
  });
});

describe("shopifySubmissionBarFindings", () => {
  it("flags nothing when every page/strategy is comfortably above both thresholds", () => {
    const matrix = [
      metric({ pageType: "home", strategy: "mobile", performanceScore: 80, accessibilityScore: 95 }),
      metric({ pageType: "collection", strategy: "mobile", performanceScore: 75, accessibilityScore: 92 }),
      metric({ pageType: "product", strategy: "mobile", performanceScore: 70, accessibilityScore: 91 }),
      metric({ pageType: "home", strategy: "desktop", performanceScore: 90, accessibilityScore: 98 }),
    ];
    expect(shopifySubmissionBarFindings("Demo store", matrix)).toEqual([]);
  });

  it("flags a low average accessibility score across the checked pages for one strategy", () => {
    const matrix = [
      metric({ pageType: "home", strategy: "mobile", performanceScore: 80, accessibilityScore: 85 }),
      metric({ pageType: "collection", strategy: "mobile", performanceScore: 80, accessibilityScore: 82 }),
      metric({ pageType: "product", strategy: "mobile", performanceScore: 80, accessibilityScore: 88 }),
    ];
    const findings = shopifySubmissionBarFindings("Demo store", matrix);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("LIVE-SHOPIFY-A11Y-SCORE-001");
    expect(findings[0].requirementId).toBe("SHOPIFY-A11Y-008");
  });

  it("flags each individual page below the performance minimum, not an average", () => {
    const matrix = [
      metric({ pageType: "home", strategy: "mobile", performanceScore: 55, accessibilityScore: 95 }),
      metric({ pageType: "collection", strategy: "mobile", performanceScore: 95, accessibilityScore: 95 }),
      metric({ pageType: "product", strategy: "mobile", performanceScore: 40, accessibilityScore: 95 }),
    ];
    const findings = shopifySubmissionBarFindings("Demo store", matrix);
    const perfFindings = findings.filter((f) => f.ruleId === "LIVE-SHOPIFY-PERF-SCORE-001");
    expect(perfFindings).toHaveLength(2);
    expect(perfFindings.every((f) => f.requirementId === "SHOPIFY-PERF-001")).toBe(true);
  });

  it("evaluates mobile and desktop independently", () => {
    const matrix = [
      metric({ pageType: "home", strategy: "mobile", performanceScore: 80, accessibilityScore: 80 }),
      metric({ pageType: "home", strategy: "desktop", performanceScore: 80, accessibilityScore: 96 }),
    ];
    const findings = shopifySubmissionBarFindings("Demo store", matrix);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("mobile");
  });

  it("never produces a blocker-severity finding — this is advisory, not a hard rule", () => {
    const matrix = [metric({ performanceScore: 0, accessibilityScore: 0 })];
    const findings = shopifySubmissionBarFindings("Demo store", matrix);
    expect(findings.every((f) => f.severity !== "blocker")).toBe(true);
  });

  it("returns an empty array when the matrix is empty", () => {
    expect(shopifySubmissionBarFindings("Demo store", [])).toEqual([]);
  });
});
