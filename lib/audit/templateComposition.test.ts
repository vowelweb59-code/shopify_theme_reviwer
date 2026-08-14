import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { composeTemplate, composeTemplateMainContent, templateBaseName } from "./templateComposition";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("templateBaseName", () => {
  it("strips the directory and extension", () => {
    expect(templateBaseName("templates/index.json")).toBe("index");
  });

  it("strips an alternate-template suffix", () => {
    expect(templateBaseName("templates/product.featured.json")).toBe("product");
  });
});

describe("composeTemplateMainContent", () => {
  it("resolves sections in the template's own render order, not object-key order", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head></head><body>{{ content_for_layout }}</body></html>",
      "templates/index.json": JSON.stringify({
        sections: { b: { type: "second" }, a: { type: "first" } },
        order: ["a", "b"],
      }),
      "sections/first.liquid": "<h1>First</h1>",
      "sections/second.liquid": "<h2>Second</h2>",
    });
    cleanup = theme.cleanup;
    const template = theme.parsed.files.find((f) => f.path === "templates/index.json")!;
    const composed = composeTemplateMainContent(template, theme.index);
    expect(composed.files.map((f) => f.path)).toEqual(["templates/index.json", "sections/first.liquid", "sections/second.liquid"]);
  });

  it("recursively includes snippets a section renders", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head></head><body>{{ content_for_layout }}</body></html>",
      "templates/index.json": JSON.stringify({ sections: { a: { type: "hero" } }, order: ["a"] }),
      "sections/hero.liquid": "<h1>Hi</h1>{% render 'promo' %}",
      "snippets/promo.liquid": "<h2>Promo</h2>",
    });
    cleanup = theme.cleanup;
    const template = theme.parsed.files.find((f) => f.path === "templates/index.json")!;
    const composed = composeTemplateMainContent(template, theme.index);
    expect(composed.files.map((f) => f.path)).toContain("snippets/promo.liquid");
  });

  it("does not include the layout", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head></head><body>{% render 'cart-drawer' %}{{ content_for_layout }}</body></html>",
      "snippets/cart-drawer.liquid": "<h2>Cart</h2>",
      "templates/index.json": JSON.stringify({ sections: {}, order: [] }),
    });
    cleanup = theme.cleanup;
    const template = theme.parsed.files.find((f) => f.path === "templates/index.json")!;
    const composed = composeTemplateMainContent(template, theme.index);
    expect(composed.files.map((f) => f.path)).not.toContain("snippets/cart-drawer.liquid");
  });
});

describe("composeTemplate", () => {
  it("includes the default layout (layout/theme.liquid) and what it renders", () => {
    // Regression test: composeTemplate previously never looked at the
    // layout at all. Found auditing Shopify's own Skeleton theme, whose
    // shared meta-tags snippet (with {{ product | structured_data }}) is
    // rendered from the layout, not any section — Product JSON-LD was
    // false-flagged as unreachable from the product template.
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head>{% render 'meta-tags' %}</head><body>{{ content_for_layout }}</body></html>",
      "snippets/meta-tags.liquid": "{{ product | structured_data }}",
      "templates/product.json": JSON.stringify({ sections: {}, order: [] }),
    });
    cleanup = theme.cleanup;
    const template = theme.parsed.files.find((f) => f.path === "templates/product.json")!;
    const composed = composeTemplate(template, theme.index);
    expect(composed.files.map((f) => f.path)).toContain("snippets/meta-tags.liquid");
  });

  it("honors a template's own layout override, and skips entirely when layout is false", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "layout/custom.liquid": "<h1>Custom layout</h1>",
      "templates/product.json": JSON.stringify({ layout: "custom", sections: {}, order: [] }),
      "templates/gift_card.json": JSON.stringify({ layout: false, sections: {}, order: [] }),
    });
    cleanup = theme.cleanup;
    const product = theme.parsed.files.find((f) => f.path === "templates/product.json")!;
    const giftCard = theme.parsed.files.find((f) => f.path === "templates/gift_card.json")!;
    expect(composeTemplate(product, theme.index).files.map((f) => f.path)).toContain("layout/custom.liquid");
    expect(composeTemplate(giftCard, theme.index).files.map((f) => f.path)).not.toContain("layout/theme.liquid");
  });
});
