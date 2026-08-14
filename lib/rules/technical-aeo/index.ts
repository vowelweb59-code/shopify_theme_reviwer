import type { Rule } from "@/lib/audit/rules";

const GOOGLE_PRODUCT_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/product";
const GOOGLE_ORG_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/organization";
const GOOGLE_ARTICLE_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/article";
const GOOGLE_BREADCRUMB_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/breadcrumb";
const SCHEMA_ORG_WEBSITE_URL = "https://schema.org/WebSite";
const GOOGLE_FAQ_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/faqpage";

function anchorPath(files: { path: string }[]): string {
  return files.find((f) => f.path.startsWith("layout/"))?.path ?? files[0]?.path ?? "layout/theme.liquid";
}

function hasJsonLdType(files: { jsonLdBlocks: { types: string[] }[] }[], type: string): boolean {
  return files.some((f) => f.jsonLdBlocks.some((b) => b.types.includes(type)));
}

// Shopify's `| structured_data` filter generates the entire JSON-LD
// <script> block server-side from a Liquid object (e.g.
// `{{ product | structured_data }}`) — the theme's source never contains
// literal JSON-LD markup for it at all, so hasJsonLdType (which scans
// parsed <script type="application/ld+json"> blocks) can never see it.
// Found auditing Shopify's own Dawn theme: main-product.liquid and
// main-article.liquid both use this filter and were false-flagged as
// missing Product/Article JSON-LD before this check existed.
function hasStructuredDataFilter(files: { rawText: string }[], objectName: string): boolean {
  const re = new RegExp(`\\b${objectName}\\s*\\|\\s*structured_data\\b`);
  return files.some((f) => re.test(f.rawText));
}

const productSchemaRule: Rule = {
  ruleId: "AEO-PRODUCT-SCHEMA-001",
  requirementId: "TECH-AEO-PRODUCT-001",
  category: "Technical AEO",
  defaultSeverity: "high",
  title: "Product templates should include Product JSON-LD",
  description: "Product template pages should include a Product JSON-LD block populated from real Shopify product data, not placeholder values.",
  sourceReference: "Google: Intro to Product structured data",
  sourceUrl: GOOGLE_PRODUCT_SD_URL,
  // Gated on the theme actually having a product template/section — a
  // theme with none genuinely has nothing to check here.
  check({ files }) {
    const hasProductFiles = files.some((f) => /product/i.test(f.path));
    if (!hasProductFiles || hasJsonLdType(files, "Product") || hasStructuredDataFilter(files, "product")) return [];
    return [
      {
        filePath: anchorPath(files),
        category: "Technical AEO" as const,
        severity: "high" as const,
        finding: "Theme has product-related templates/sections but no Product JSON-LD block was found anywhere.",
        recommendation: "Add a Product JSON-LD block (or use Shopify's `| structured_data` filter) to the product template.",
      },
    ];
  },
};

const organizationSchemaRule: Rule = {
  ruleId: "AEO-ORG-SCHEMA-001",
  requirementId: "TECH-AEO-ORG-001",
  category: "Technical AEO",
  defaultSeverity: "medium",
  title: "Theme should include Organization JSON-LD",
  description: "Theme should include an Organization JSON-LD block (typically in the layout) identifying the store.",
  sourceReference: "Google: Organization structured data",
  sourceUrl: GOOGLE_ORG_SD_URL,
  check({ files }) {
    if (hasJsonLdType(files, "Organization")) return [];
    return [
      {
        filePath: anchorPath(files),
        category: "Technical AEO" as const,
        severity: "medium" as const,
        finding: "No Organization JSON-LD block was found anywhere in the theme.",
        recommendation: "Add an Organization JSON-LD block (e.g. in the layout or header) identifying the store.",
      },
    ];
  },
};

const articleSchemaRule: Rule = {
  ruleId: "AEO-ARTICLE-SCHEMA-001",
  requirementId: "TECH-AEO-ARTICLE-001",
  category: "Technical AEO",
  defaultSeverity: "medium",
  title: "Blog/article templates should include Article JSON-LD",
  description: "Blog/article templates should include an Article JSON-LD block.",
  sourceReference: "Google: Article structured data",
  sourceUrl: GOOGLE_ARTICLE_SD_URL,
  check({ files }) {
    const hasArticleFiles = files.some((f) => /article|blog/i.test(f.path));
    if (!hasArticleFiles || hasJsonLdType(files, "Article") || hasStructuredDataFilter(files, "article")) return [];
    return [
      {
        filePath: anchorPath(files),
        category: "Technical AEO" as const,
        severity: "medium" as const,
        finding: "Theme has blog/article templates but no Article JSON-LD block was found anywhere.",
        recommendation: "Add an Article JSON-LD block to the article template.",
      },
    ];
  },
};

const breadcrumbSchemaRule: Rule = {
  ruleId: "AEO-BREADCRUMB-SCHEMA-001",
  requirementId: "TECH-AEO-BREADCRUMB-001",
  category: "Technical AEO",
  defaultSeverity: "medium",
  title: "Non-homepage templates should include BreadcrumbList JSON-LD",
  description: "Collection, product, and article templates should include a BreadcrumbList JSON-LD block reflecting the page's place in the site hierarchy.",
  sourceReference: "Google: Breadcrumb structured data",
  sourceUrl: GOOGLE_BREADCRUMB_SD_URL,
  // Gated on the theme actually having collection/product/article
  // templates — virtually every real theme does, but a stripped-down or
  // highly custom one might genuinely have nothing to check here.
  check({ files }) {
    const hasNonHomeTemplates = files.some((f) => /^templates\/(collection|product|article)\b/i.test(f.path));
    if (!hasNonHomeTemplates || hasJsonLdType(files, "BreadcrumbList")) return [];
    return [
      {
        filePath: anchorPath(files),
        category: "Technical AEO" as const,
        severity: "medium" as const,
        finding: "Theme has collection/product/article templates but no BreadcrumbList JSON-LD block was found anywhere.",
        recommendation: "Add a BreadcrumbList JSON-LD block (at least two ListItems: position, name, item URL) to non-homepage templates.",
      },
    ];
  },
};

const websiteSchemaRule: Rule = {
  ruleId: "AEO-WEBSITE-SCHEMA-001",
  requirementId: "TECH-AEO-WEBSITE-001",
  category: "Technical AEO",
  defaultSeverity: "low",
  title: "Theme should include a sitewide WebSite JSON-LD entity",
  description:
    "Theme should include a WebSite JSON-LD block (name, url) with a stable @id, so other structured data can reference it via isPartOf rather than repeating site identity. Not for the sitelinks search box — Google retired that feature in November 2024.",
  sourceReference: "schema.org: WebSite",
  sourceUrl: SCHEMA_ORG_WEBSITE_URL,
  check({ files }) {
    if (hasJsonLdType(files, "WebSite")) return [];
    return [
      {
        filePath: anchorPath(files),
        category: "Technical AEO" as const,
        severity: "low" as const,
        finding: "No WebSite JSON-LD block was found anywhere in the theme.",
        recommendation: "Add a WebSite JSON-LD block (name, url, stable @id) to the layout so other schema can reference it via isPartOf.",
      },
    ];
  },
};

const faqSchemaRule: Rule = {
  ruleId: "AEO-FAQ-SCHEMA-001",
  requirementId: "TECH-AEO-FAQ-001",
  category: "Technical AEO",
  defaultSeverity: "low",
  title: "Pages with FAQ content should include FAQPage JSON-LD",
  description:
    "A page or section presenting a Q&A/FAQ accordion should mark it up with FAQPage JSON-LD (mainEntity: Question/Answer pairs). Google discontinued the FAQ rich-result SERP feature (June 2026); this is now about structural/entity completeness, not SERP appearance.",
  sourceReference: "Google: FAQPage structured data",
  sourceUrl: GOOGLE_FAQ_SD_URL,
  // Gated on the theme actually having an FAQ-named file — there's no
  // reliable theme-wide way to know FAQ content exists otherwise.
  check({ files }) {
    const hasFaqFiles = files.some((f) => /faq/i.test(f.path));
    if (!hasFaqFiles || hasJsonLdType(files, "FAQPage")) return [];
    return [
      {
        filePath: anchorPath(files),
        category: "Technical AEO" as const,
        severity: "low" as const,
        finding: "Theme has FAQ-related content but no FAQPage JSON-LD block was found anywhere.",
        recommendation: "Add a FAQPage JSON-LD block built from the same source as the visible FAQ content, so they never drift apart.",
      },
    ];
  },
};

export const TECHNICAL_AEO_RULES: Rule[] = [
  productSchemaRule,
  organizationSchemaRule,
  articleSchemaRule,
  breadcrumbSchemaRule,
  websiteSchemaRule,
  faqSchemaRule,
];
