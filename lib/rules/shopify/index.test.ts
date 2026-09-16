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

function ruleFindingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = SHOPIFY_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("SHOPIFY-CSS-NOSASS-001", () => {
  it("flags a .scss file", () => {
    const theme = buildTestTheme({ "assets/theme.scss": ".btn { color: red; }" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-CSS-NOSASS-001", theme)).toHaveLength(1);
  });

  it("flags a .scss.liquid file", () => {
    const theme = buildTestTheme({ "assets/theme.scss.liquid": ".btn {{ color }}" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-CSS-NOSASS-001", theme)).toHaveLength(1);
  });

  it("does not flag a plain .css file", () => {
    const theme = buildTestTheme({ "assets/theme.css": ".btn { color: red; }" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-CSS-NOSASS-001", theme)).toHaveLength(0);
  });

  it("does not flag a filename that merely contains 'scss' mid-name, not as the extension", () => {
    const theme = buildTestTheme({ "assets/scssish-theme.css": ".btn { color: red; }" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-CSS-NOSASS-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-LIQUID-CONTENTFORHEADER-001", () => {
  it("flags content_for_header itself being reassigned", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "{% assign content_for_header = '' %}" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LIQUID-CONTENTFORHEADER-001", theme)).toHaveLength(1);
  });

  it("flags content_for_header being captured into a variable", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "{% capture content_for_header %}{% endcapture %}" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LIQUID-CONTENTFORHEADER-001", theme)).toHaveLength(1);
  });

  it("flags content_for_header being piped through a filter", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "{{ content_for_header | strip_html }}" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LIQUID-CONTENTFORHEADER-001", theme)).toHaveLength(1);
  });

  it("does not flag plain, unmodified output of content_for_header", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "{{ content_for_header }}" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LIQUID-CONTENTFORHEADER-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-LINKS-NOFOLLOW-001", () => {
  it("flags a link to a shopify.com domain missing rel=nofollow", () => {
    const theme = buildTestTheme({ "sections/footer.liquid": '<a href="https://www.shopify.com/legal">Legal</a>' });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LINKS-NOFOLLOW-001", theme)).toHaveLength(1);
  });

  it("does not flag a shopify.com link that already has rel=nofollow", () => {
    const theme = buildTestTheme({
      "sections/footer.liquid": '<a href="https://www.shopify.com/legal" rel="nofollow">Legal</a>',
    });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LINKS-NOFOLLOW-001", theme)).toHaveLength(0);
  });

  it("does not flag a link to an unrelated domain", () => {
    const theme = buildTestTheme({ "sections/footer.liquid": '<a href="https://example.com/legal">Legal</a>' });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-LINKS-NOFOLLOW-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-SEO-NOROBOTS-001", () => {
  it("flags a robots.txt.liquid template", () => {
    const theme = buildTestTheme({ "templates/robots.txt.liquid": "{{ 'robots.txt.liquid' }}" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-SEO-NOROBOTS-001", theme)).toHaveLength(1);
  });

  it("does not flag an unrelated template file", () => {
    const theme = buildTestTheme({ "templates/index.liquid": "<div>Home</div>" });
    cleanup = theme.cleanup;
    expect(ruleFindingsFor("SHOPIFY-SEO-NOROBOTS-001", theme)).toHaveLength(0);
  });
});
