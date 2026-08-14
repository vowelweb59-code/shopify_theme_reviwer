import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { TECHNICAL_AEO_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = TECHNICAL_AEO_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("AEO-PRODUCT-SCHEMA-001", () => {
  it("flags a theme with product templates and no Product JSON-LD anywhere", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "templates/product.json": '{"sections": {}}',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("AEO-PRODUCT-SCHEMA-001", theme)).toHaveLength(1);
  });

  it("does not flag a literal <script type=application/ld+json> Product block", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "templates/product.json": '{"sections": {}}',
      "sections/main-product.liquid":
        '<script type="application/ld+json">{"@context":"https://schema.org/","@type":"Product"}</script>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("AEO-PRODUCT-SCHEMA-001", theme)).toHaveLength(0);
  });

  // Regression test: found auditing Shopify's own Dawn theme
  // (sections/main-product.liquid), which uses Shopify's built-in
  // | structured_data filter to generate the JSON-LD server-side — there's
  // no literal <script type="application/ld+json"> markup in the theme's
  // source for this rule to find at all.
  it("does not flag Shopify's | structured_data filter as missing Product schema", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "templates/product.json": '{"sections": {}}',
      "sections/main-product.liquid": "{{ product | structured_data }}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("AEO-PRODUCT-SCHEMA-001", theme)).toHaveLength(0);
  });

  it("does not flag a theme with no product-related files at all", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "<html></html>" });
    cleanup = theme.cleanup;
    expect(findingsFor("AEO-PRODUCT-SCHEMA-001", theme)).toHaveLength(0);
  });
});

describe("AEO-ARTICLE-SCHEMA-001", () => {
  it("does not flag Shopify's | structured_data filter as missing Article schema", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "templates/blog.json": '{"sections": {}}',
      "sections/main-article.liquid": "{{ article | structured_data }}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("AEO-ARTICLE-SCHEMA-001", theme)).toHaveLength(0);
  });
});
