import type { ExecutedFinding } from "../runRules";
import type { PageFacts } from "./fetchPageFacts";

/**
 * JSON-LD/canonical/meta-description checks against a live rendered
 * homepage — these look for exactly the same server-rendered markup a
 * static source scan can't reliably confirm exists (Shopify's own
 * `| structured_data` filter and section rendering are only knowable by
 * actually requesting the page). See fetchPageFacts.ts's own comment for
 * the one thing this can't see (JS-injected content after load).
 */
export function homepageFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  if (!facts.jsonLdTypes.includes("Organization")) {
    findings.push({
      ruleId: "LIVE-JSONLD-ORG-001",
      requirementId: "TECH-AEO-ORG-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "medium",
      finding: "No Organization JSON-LD was found on the live rendered homepage.",
      recommendation: "Add an Organization JSON-LD block to the homepage.",
    });
  }
  if (!facts.jsonLdTypes.includes("WebSite")) {
    findings.push({
      ruleId: "LIVE-JSONLD-WEBSITE-001",
      requirementId: "TECH-AEO-WEBSITE-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "low",
      finding: "No WebSite JSON-LD was found on the live rendered homepage.",
      recommendation: "Add a WebSite JSON-LD block to the homepage.",
    });
  }
  if (!facts.canonical) {
    findings.push({
      ruleId: "LIVE-SEO-CANONICAL-001",
      requirementId: "SHOPIFY-SEO-001",
      filePath: facts.url,
      category: "Technical SEO",
      severity: "high",
      finding: "No canonical link tag was found on the live rendered homepage.",
      recommendation: 'Add <link rel="canonical"> to the page head.',
    });
  }
  if (!facts.metaDescription) {
    findings.push({
      ruleId: "LIVE-SEO-METADESC-001",
      requirementId: "SHOPIFY-SEO-001",
      filePath: facts.url,
      category: "Technical SEO",
      severity: "medium",
      finding: "No meta description tag was found on the live rendered homepage.",
      recommendation: 'Add a <meta name="description"> tag.',
    });
  }
  return findings;
}

export function productPageFindings(facts: PageFacts): ExecutedFinding[] {
  const findings: ExecutedFinding[] = [];
  if (!facts.jsonLdTypes.includes("Product")) {
    findings.push({
      ruleId: "LIVE-JSONLD-PRODUCT-001",
      requirementId: "TECH-AEO-PRODUCT-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "high",
      finding: "No Product JSON-LD was found on the live rendered product page.",
      recommendation: "Add Product JSON-LD (or Shopify's | structured_data filter) to the product template.",
    });
  }
  if (!facts.jsonLdTypes.includes("BreadcrumbList")) {
    findings.push({
      ruleId: "LIVE-JSONLD-BREADCRUMB-001",
      requirementId: "TECH-AEO-BREADCRUMB-001",
      filePath: facts.url,
      category: "Technical AEO",
      severity: "medium",
      finding: "No BreadcrumbList JSON-LD was found on the live rendered product page.",
      recommendation: "Add a BreadcrumbList JSON-LD block to the product page.",
    });
  }
  return findings;
}
