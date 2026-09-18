import { describe, expect, it } from "vitest";
import { comparePresets, type PresetFacts } from "./presetComparison";
import type { PageFacts } from "./fetchPageFacts";

function page(overrides: Partial<PageFacts> = {}): PageFacts {
  return {
    url: "https://example.com",
    jsonLdTypes: ["Organization", "WebSite"],
    canonical: "https://example.com/",
    metaDescription: "A store",
    sectionIds: ["header", "hero", "footer"],
    firstProductLink: null,
    ...overrides,
  };
}

describe("comparePresets", () => {
  it("returns no findings for a single preset", () => {
    expect(comparePresets([{ label: "Main", home: page() }])).toEqual([]);
  });

  it("returns no findings when every preset matches the baseline", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page() },
      { label: "Alt", home: page({ url: "https://alt.example.com" }) },
    ];
    expect(comparePresets(presets)).toEqual([]);
  });

  it("flags a section-count drift at or above the threshold", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page() },
      { label: "Alt", home: page({ url: "https://alt.example.com", sectionIds: ["header"] }) },
    ];
    const findings = comparePresets(presets);
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-PRESET-SYNC-SECTIONS-001");
  });

  it("does not flag a section-count drift below the threshold", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page() },
      { label: "Alt", home: page({ url: "https://alt.example.com", sectionIds: ["header", "hero"] }) },
    ];
    expect(comparePresets(presets).some((f) => f.ruleId === "LIVE-PRESET-SYNC-SECTIONS-001")).toBe(false);
  });

  it("flags JSON-LD types missing from a non-baseline preset", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page() },
      { label: "Alt", home: page({ url: "https://alt.example.com", jsonLdTypes: ["Organization"] }) },
    ];
    const findings = comparePresets(presets);
    const finding = findings.find((f) => f.ruleId === "LIVE-PRESET-SYNC-JSONLD-001");
    expect(finding?.finding).toContain("WebSite");
  });

  it("flags a missing canonical/meta description on a non-baseline preset", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page() },
      { label: "Alt", home: page({ url: "https://alt.example.com", canonical: null, metaDescription: null }) },
    ];
    const findings = comparePresets(presets).filter((f) => f.ruleId === "LIVE-PRESET-SYNC-METADATA-001");
    expect(findings.length).toBe(2);
  });

  it("compares product pages too when both presets have one", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page(), product: page({ url: "https://example.com/products/a" }) },
      {
        label: "Alt",
        home: page({ url: "https://alt.example.com" }),
        product: page({ url: "https://alt.example.com/products/a", jsonLdTypes: [] }),
      },
    ];
    const findings = comparePresets(presets);
    expect(findings.some((f) => f.finding.includes("product page"))).toBe(true);
  });

  it("skips the product-page comparison when one preset has no product page", () => {
    const presets: PresetFacts[] = [
      { label: "Main", home: page(), product: page({ url: "https://example.com/products/a" }) },
      { label: "Alt", home: page({ url: "https://alt.example.com" }) },
    ];
    expect(() => comparePresets(presets)).not.toThrow();
  });
});
