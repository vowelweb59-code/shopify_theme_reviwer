import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { isExternalReference, localeKeyExists, resolveSchemaString } from "./themeIndex";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("isExternalReference", () => {
  it("treats http(s) and protocol-relative URLs as external", () => {
    expect(isExternalReference("https://example.com/x.jpg")).toBe(true);
    expect(isExternalReference("http://example.com/x.jpg")).toBe(true);
    expect(isExternalReference("//example.com/x.jpg")).toBe(true);
  });

  it("does not treat a bare local filename as external", () => {
    expect(isExternalReference("hero.jpg")).toBe(false);
  });
});

describe("buildThemeIndex", () => {
  it("discovers images/fonts under assets/ even though they're never structurally parsed", () => {
    // Regression test: walkThemeFiles used to only classify .liquid/.json/
    // .css/.js — every image/font under assets/ was silently skipped and
    // never reached assetBasenames, so every reference to a real asset was
    // guaranteed to be reported missing. Found auditing Shopify's own Dawn
    // theme (241 false "missing asset" findings from this alone).
    const theme = buildTestTheme({
      "assets/icon-arrow.svg": "<svg></svg>",
      "assets/theme.css": "body{color:red}",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(theme.index.assetBasenames.has("icon-arrow.svg")).toBe(true);
    expect(theme.index.assetBasenames.has("theme.css")).toBe(true);
  });

  it("indexes sections, section groups, and snippets by basename", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": "<h1>hi</h1>",
      "sections/header-group.json": '{"type": "header", "sections": {}}',
      "snippets/card.liquid": "<div></div>",
    });
    cleanup = theme.cleanup;
    expect(theme.index.sectionsByName.has("hero")).toBe(true);
    expect(theme.index.sectionGroupsByName.has("header-group")).toBe(true);
    expect(theme.index.snippetsByName.has("card")).toBe(true);
  });
});

describe("localeKeyExists", () => {
  it("resolves a leaf string key", () => {
    const theme = buildTestTheme({
      "locales/en.default.json": '{"products": {"product": {"add_to_cart": "Add to cart"}}}',
    });
    cleanup = theme.cleanup;
    expect(localeKeyExists(theme.index, "products.product.add_to_cart")).toBe(true);
    expect(localeKeyExists(theme.index, "products.product.missing")).toBe(false);
  });

  it("resolves a pluralization group (an object, not a leaf) as existing", () => {
    const theme = buildTestTheme({
      "locales/en.default.json": '{"cart": {"item_count": {"one": "1 item", "other": "{{ count }} items"}}}',
    });
    cleanup = theme.cleanup;
    expect(localeKeyExists(theme.index, "cart.item_count")).toBe(true);
  });
});

describe("resolveSchemaString", () => {
  it("returns a literal (non t:) string unchanged", () => {
    const theme = buildTestTheme({ "layout/theme.liquid": "<html></html>" });
    cleanup = theme.cleanup;
    expect(resolveSchemaString(theme.index, "Collage")).toBe("Collage");
  });

  it("resolves a t: schema translation key against the schema locale file", () => {
    // Regression test: Shopify's own Dawn theme (and any professionally
    // localized theme) uses "t:sections.x.name"-style schema translation
    // keys pervasively — comparing the raw key string instead of resolving
    // it produced false positives in INTERNAL-CONTENT-HEADING-001.
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "locales/en.default.schema.json": '{"sections": {"collage": {"name": "Collage"}}}',
    });
    cleanup = theme.cleanup;
    expect(resolveSchemaString(theme.index, "t:sections.collage.name")).toBe("Collage");
  });

  it("returns undefined for an unresolvable t: key rather than the raw key text", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html></html>",
      "locales/en.default.schema.json": '{"sections": {}}',
    });
    cleanup = theme.cleanup;
    expect(resolveSchemaString(theme.index, "t:sections.missing.name")).toBeUndefined();
  });
});
