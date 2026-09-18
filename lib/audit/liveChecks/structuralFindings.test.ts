import { describe, expect, it } from "vitest";
import { homepageFindings, productPageFindings } from "./structuralFindings";
import type { PageFacts } from "./fetchPageFacts";

function facts(overrides: Partial<PageFacts> = {}): PageFacts {
  return {
    url: "https://example.com",
    jsonLdTypes: ["Organization", "WebSite"],
    canonical: "https://example.com/",
    metaDescription: "A store",
    sectionIds: ["header", "hero"],
    firstProductLink: null,
    ...overrides,
  };
}

describe("homepageFindings", () => {
  it("flags nothing when Organization/WebSite JSON-LD, canonical, and meta description are all present", () => {
    expect(homepageFindings(facts())).toHaveLength(0);
  });

  it("flags missing Organization JSON-LD", () => {
    const findings = homepageFindings(facts({ jsonLdTypes: ["WebSite"] }));
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-JSONLD-ORG-001");
  });

  it("flags missing WebSite JSON-LD", () => {
    const findings = homepageFindings(facts({ jsonLdTypes: ["Organization"] }));
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-JSONLD-WEBSITE-001");
  });

  it("flags a missing canonical link as high severity", () => {
    const findings = homepageFindings(facts({ canonical: null }));
    const finding = findings.find((f) => f.ruleId === "LIVE-SEO-CANONICAL-001");
    expect(finding?.severity).toBe("high");
  });

  it("flags a missing meta description", () => {
    const findings = homepageFindings(facts({ metaDescription: null }));
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-SEO-METADESC-001");
  });
});

describe("productPageFindings", () => {
  it("flags nothing when Product/BreadcrumbList JSON-LD are present", () => {
    expect(productPageFindings(facts({ jsonLdTypes: ["Product", "BreadcrumbList"] }))).toHaveLength(0);
  });

  it("flags missing Product JSON-LD as high severity", () => {
    const findings = productPageFindings(facts({ jsonLdTypes: [] }));
    const finding = findings.find((f) => f.ruleId === "LIVE-JSONLD-PRODUCT-001");
    expect(finding?.severity).toBe("high");
  });

  it("flags missing BreadcrumbList JSON-LD", () => {
    const findings = productPageFindings(facts({ jsonLdTypes: ["Product"] }));
    expect(findings.map((f) => f.ruleId)).toContain("LIVE-JSONLD-BREADCRUMB-001");
  });
});
