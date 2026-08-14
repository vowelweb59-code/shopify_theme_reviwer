import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { CROSS_FILE_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = CROSS_FILE_RULES.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`No rule registered with id ${ruleId}`);
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

const BASE_LAYOUT = {
  "layout/theme.liquid": "<html><head></head><body>{{ content_for_layout }}</body></html>",
  "config/settings_schema.json": "[]",
  "locales/en.default.json": "{}",
};

describe("REF-SECTION-MISSING-001", () => {
  it("flags a {% section %} referencing a nonexistent section", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "sections/hero.liquid": "{% section 'does-not-exist' %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SECTION-MISSING-001", theme)).toHaveLength(1);
  });

  it("does not flag a {% sections %} tag resolving to a JSON section group (not a .liquid section)", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "layout/theme.liquid": "<html><body>{% sections 'header-group' %}{{ content_for_layout }}</body></html>",
      "sections/header-group.json": '{"type": "header", "sections": {}}',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SECTION-MISSING-001", theme)).toHaveLength(0);
  });

  it("does not flag a dynamic (non-literal) section reference", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "sections/hero.liquid": "{% section section_name %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SECTION-MISSING-001", theme)).toHaveLength(0);
  });
});

describe("REF-ASSET-MISSING-001", () => {
  it("flags a reference to an asset that doesn't exist", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "sections/hero.liquid": "{{ 'missing.js' | asset_url }}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-ASSET-MISSING-001", theme)).toHaveLength(1);
  });

  it("does not flag an asset that exists", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "assets/theme.js": "console.log(1);",
      "sections/hero.liquid": "{{ 'theme.js' | asset_url }}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-ASSET-MISSING-001", theme)).toHaveLength(0);
  });

  // Regression test: found auditing Shopify's own Dawn theme, which pipes
  // some filenames through shopify_asset_url (Shopify's own platform-wide
  // asset library — e.g. the gift card QR code graphic) rather than
  // asset_url (the theme's own assets/ folder). The two must never be
  // checked against assets/ the same way.
  it("does not flag a filename resolved via shopify_asset_url (Shopify's own asset library, not the theme's)", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "templates/gift_card.liquid": "<script src=\"{{ 'vendor/qrcode.js' | shopify_asset_url }}\"></script>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-ASSET-MISSING-001", theme)).toHaveLength(0);
  });

  // Regression test: found auditing Shopify's own Dawn theme
  // (snippets/icon-accordion.liquid), where a dynamically-built filename
  // (`{% assign file = icon | append: '.svg' %}`) left a bare '.svg'
  // filter-argument fragment that the old regex matched as if it were a
  // complete, literal asset filename.
  it("does not flag a bare extension fragment from a dynamically-built filename", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "snippets/icon.liquid": "{%- assign file = icon | append: '.svg' -%}{{ file | inline_asset_content }}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-ASSET-MISSING-001", theme)).toHaveLength(0);
  });

  it("does not flag an external (absolute/protocol-relative) URL", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "sections/hero.liquid": '<img src="https://cdn.example.com/hero.jpg">',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-ASSET-MISSING-001", theme)).toHaveLength(0);
  });
});

describe("REF-SETTINGS-GLOBAL-MISSING-001", () => {
  it("flags a bare settings.x reference with no matching global setting", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "config/settings_schema.json": '[{"name": "Colors", "settings": [{"type": "color", "id": "bg"}]}]',
      "layout/theme.liquid": "<html>{{ settings.undeclared }}</html>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-GLOBAL-MISSING-001", theme)).toHaveLength(1);
  });

  it("does not flag a declared global setting", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "config/settings_schema.json": '[{"name": "Colors", "settings": [{"type": "color", "id": "bg"}]}]',
      "layout/theme.liquid": "<html>{{ settings.bg }}</html>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-GLOBAL-MISSING-001", theme)).toHaveLength(0);
  });

  // Regression test: found auditing Shopify's own Dawn theme
  // (layout/password.liquid, layout/theme.liquid), which does
  // `{% for scheme in settings.color_schemes %}` then reads
  // `scheme.settings.background` — a completely standard OS 2.0 pattern.
  // The old regex only recognized "section."/"block." prefixes and
  // defaulted anything else (including "scheme.") to being a bare global
  // reference, producing dozens of false positives.
  it("does not validate settings.x preceded by an arbitrary loop variable (scope 'other')", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "config/settings_schema.json": "[]",
      "layout/theme.liquid":
        "{% for scheme in settings.color_schemes %}{{ scheme.settings.background }}{% endfor %}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-GLOBAL-MISSING-001", theme)).toHaveLength(0);
  });

  it("skips the check entirely when no settings_schema.json was found (avoids false positives on a non-standard layout)", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html>{{ settings.whatever }}</html>",
      "locales/en.default.json": "{}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-GLOBAL-MISSING-001", theme)).toHaveLength(0);
  });
});

describe("SHOPIFY-SECTIONS-SCOPE-001", () => {
  it("flags a section in a header/footer group with no enabled_on/disabled_on", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "sections/header-group.json": '{"type": "header", "sections": {"a": {"type": "main-header"}}, "order": ["a"]}',
      "sections/main-header.liquid": '{% schema %}{"name": "Header"}{% endschema %}',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SECTIONS-SCOPE-001", theme)).toHaveLength(1);
  });

  it("does not flag a section that declares enabled_on", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "sections/footer-group.json": '{"type": "footer", "sections": {"a": {"type": "main-footer"}}, "order": ["a"]}',
      "sections/main-footer.liquid": '{% schema %}{"name": "Footer", "enabled_on": {"groups": ["footer"]}}{% endschema %}',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SHOPIFY-SECTIONS-SCOPE-001", theme)).toHaveLength(0);
  });
});

describe("AEO-PRODUCT-SCHEMA-COMPOSED-001 / AEO-ARTICLE-SCHEMA-COMPOSED-001", () => {
  it("does not flag Product JSON-LD rendered from the layout's own snippet, reachable from every page", () => {
    // Regression test: found auditing Shopify's own Skeleton theme, whose
    // shared meta-tags snippet is rendered from the layout, not any
    // section.
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head>{% render 'meta-tags' %}</head><body>{{ content_for_layout }}</body></html>",
      "snippets/meta-tags.liquid": "{{ product | structured_data }}",
      "templates/product.json": JSON.stringify({ sections: {}, order: [] }),
      "config/settings_schema.json": "[]",
      "locales/en.default.json": "{}",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("AEO-PRODUCT-SCHEMA-COMPOSED-001", theme)).toHaveLength(0);
  });

  it("flags duplicate Product JSON-LD when two sections in the same template both render it", () => {
    const theme = buildTestTheme({
      ...BASE_LAYOUT,
      "templates/product.json": JSON.stringify({ sections: { a: { type: "main" }, b: { type: "extra" } }, order: ["a", "b"] }),
      "sections/main.liquid": "{{ product | structured_data }}",
      "sections/extra.liquid": "{{ product | structured_data }}",
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("AEO-PRODUCT-SCHEMA-COMPOSED-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("medium");
  });
});
