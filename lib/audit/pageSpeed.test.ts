import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractCoreMetrics,
  extractOpportunityFindings,
  fallbackThresholdFindings,
  fetchPsiLighthouseResult,
  psiThresholdFindings,
  shopifySubmissionBarFindings,
  type LighthouseAudit,
  type LighthouseAuditRef,
  type LighthouseResult,
  type PageSpeedMetric,
} from "./pageSpeed";

function metric(overrides: Partial<PageSpeedMetric> = {}): PageSpeedMetric {
  return { label: "Demo store", url: "https://example.com", pageType: "home", strategy: "mobile", source: "psi", ...overrides };
}

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

describe("fallbackThresholdFindings", () => {
  it("flags nothing for fast TTFB and a light page", () => {
    const findings = fallbackThresholdFindings("Demo store", "https://example.com", {
      ttfbMs: 200,
      fcpMs: 800,
      pageWeightBytes: 500_000,
    });
    expect(findings).toHaveLength(0);
  });

  it("flags slow TTFB as a capped-medium, distinctly-named heuristic finding", () => {
    const findings = fallbackThresholdFindings("Demo store", "https://example.com", {
      ttfbMs: 1200,
      fcpMs: null,
      pageWeightBytes: 0,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("LIVE-PERF-TTFB-001");
    expect(findings[0].severity).toBe("medium");
  });

  it("flags heavy page weight as a capped-medium, distinctly-named heuristic finding", () => {
    const findings = fallbackThresholdFindings("Demo store", "https://example.com", {
      ttfbMs: 0,
      fcpMs: null,
      pageWeightBytes: 5_000_000,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("LIVE-PERF-WEIGHT-001");
    expect(findings[0].severity).toBe("medium");
  });
});

describe("fetchPsiLighthouseResult", () => {
  const originalEnv = process.env.PAGESPEED_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null without ever calling fetch when no API key is configured", async () => {
    delete process.env.PAGESPEED_API_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const result = await fetchPsiLighthouseResult("https://example.com");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the full lighthouseResult object from a real-shaped PSI response", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const lighthouseResult = {
      categories: { performance: { score: 0.87 } },
      audits: { "largest-contentful-paint": { score: 1, numericValue: 2100 } },
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult }) }) as unknown as typeof fetch;

    const result = await fetchPsiLighthouseResult("https://example.com");
    expect(result).toEqual(lighthouseResult);
  });

  it("returns null when the PSI request fails", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await fetchPsiLighthouseResult("https://example.com")).toBeNull();
  });

  it("returns null when fetch throws (e.g. timeout/network error)", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as unknown as typeof fetch;
    expect(await fetchPsiLighthouseResult("https://example.com")).toBeNull();
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

describe("fetchPsiLighthouseResult — strategy and categories", () => {
  const originalEnv = process.env.PAGESPEED_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("passes strategy and repeats category once per requested category", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult: {} }) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchPsiLighthouseResult("https://example.com", "desktop", ["performance", "accessibility"]);

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("strategy")).toBe("desktop");
    expect(calledUrl.searchParams.getAll("category")).toEqual(["performance", "accessibility"]);
  });

  it("defaults to mobile strategy and performance-only category", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lighthouseResult: {} }) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchPsiLighthouseResult("https://example.com");

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("strategy")).toBe("mobile");
    expect(calledUrl.searchParams.getAll("category")).toEqual(["performance"]);
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
