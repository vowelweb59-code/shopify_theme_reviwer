import type { Rule } from "@/lib/audit/rules";

const GOOGLE_PRODUCT_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/product";
const GOOGLE_ORG_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/organization";
const GOOGLE_ARTICLE_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/article";

function anchorPath(files: { path: string }[]): string {
  return files.find((f) => f.path.startsWith("layout/"))?.path ?? files[0]?.path ?? "layout/theme.liquid";
}

function hasJsonLdType(files: { jsonLdBlocks: { types: string[] }[] }[], type: string): boolean {
  return files.some((f) => f.jsonLdBlocks.some((b) => b.types.includes(type)));
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
    if (!hasProductFiles || hasJsonLdType(files, "Product")) return [];
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
    if (!hasArticleFiles || hasJsonLdType(files, "Article")) return [];
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

export const TECHNICAL_AEO_RULES: Rule[] = [productSchemaRule, organizationSchemaRule, articleSchemaRule];
