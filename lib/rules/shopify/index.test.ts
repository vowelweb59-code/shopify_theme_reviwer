import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { SHOPIFY_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function hardcodedTextFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = SHOPIFY_RULES.find((r) => r.ruleId === "SHOPIFY-LOCALE-HARDCODED-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("SHOPIFY-LOCALE-HARDCODED-001", () => {
  it("flags a button whose literal text exactly matches a known storefront control", () => {
    const theme = buildTestTheme({ "sections/product-form.liquid": "<button>Add to cart</button>" });
    cleanup = theme.cleanup;
    const findings = hardcodedTextFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("Add to cart");
  });

  it("flags a link whose aria-label exactly matches a known storefront control", () => {
    const theme = buildTestTheme({ "sections/header.liquid": '<a href="/search" aria-label="Search"></a>' });
    cleanup = theme.cleanup;
    const findings = hardcodedTextFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("aria-label");
  });

  it("does not flag text already run through the t translation filter", () => {
    const theme = buildTestTheme({
      "sections/product-form.liquid": "<button>{{ 'products.product.add_to_cart' | t }}</button>",
    });
    cleanup = theme.cleanup;
    expect(hardcodedTextFindings(theme)).toHaveLength(0);
  });

  it("does not flag a brand name or marketing copy outside the curated list", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "<a href=\"/collections/all\">Shop the Acme Collection</a>" });
    cleanup = theme.cleanup;
    expect(hardcodedTextFindings(theme)).toHaveLength(0);
  });

  it("does not flag a phrase that merely contains a known control inside longer copy", () => {
    const theme = buildTestTheme({ "sections/product-form.liquid": "<button>Add to Cart for free shipping</button>" });
    cleanup = theme.cleanup;
    expect(hardcodedTextFindings(theme)).toHaveLength(0);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const theme = buildTestTheme({ "sections/product-form.liquid": "<button>  SOLD OUT  </button>" });
    cleanup = theme.cleanup;
    expect(hardcodedTextFindings(theme)).toHaveLength(1);
  });
});
