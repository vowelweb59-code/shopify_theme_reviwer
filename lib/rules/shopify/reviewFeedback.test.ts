import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { SHOPIFY_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, files: Record<string, string>): RuleFinding[] {
  const theme = buildTestTheme(files);
  cleanup = theme.cleanup;
  const rule = SHOPIFY_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

const schema = (json: object) => `{{ section.settings.custom_liquid }}\n{% schema %}${JSON.stringify(json)}{% endschema %}`;
const LIQUID_SETTING = { type: "liquid", id: "custom_liquid", label: "Custom Liquid" };

describe("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", () => {
  it("passes with a Custom Liquid section that has a preset and no restriction", () => {
    const findings = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/custom-liquid.liquid": schema({ name: "Custom Liquid", settings: [LIQUID_SETTING], presets: [{ name: "Custom Liquid" }] }),
    });
    expect(findings).toHaveLength(0);
  });

  it("passes with enabled_on templates [\"*\"]", () => {
    const findings = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/custom-liquid.liquid": schema({
        name: "Custom Liquid",
        settings: [LIQUID_SETTING],
        presets: [{ name: "Custom Liquid" }],
        enabled_on: { templates: ["*"] },
      }),
    });
    expect(findings).toHaveLength(0);
  });

  it("flags a theme with no liquid setting on any section", () => {
    const findings = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/hero.liquid": schema({ name: "Hero", settings: [], presets: [{ name: "Hero" }] }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("blocker");
    expect(findings[0].finding).toContain("No section declares a setting of type liquid");
  });

  it("explains when the liquid setting only exists on a block", () => {
    const findings = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/hero.liquid": schema({ name: "Hero", settings: [], presets: [{ name: "Hero" }] }),
      "blocks/custom-liquid.liquid": schema({ name: "Custom Liquid", settings: [LIQUID_SETTING] }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].filePath).toBe("blocks/custom-liquid.liquid");
    expect(findings[0].finding).toContain("only on a block");
  });

  it("flags a Custom Liquid section without presets", () => {
    const findings = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/custom-liquid.liquid": schema({ name: "Custom Liquid", settings: [LIQUID_SETTING] }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("no presets");
  });

  it("flags a Custom Liquid section limited to some templates", () => {
    const findings = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/custom-liquid.liquid": schema({
        name: "Custom Liquid",
        settings: [LIQUID_SETTING],
        presets: [{ name: "Custom Liquid" }],
        enabled_on: { templates: ["index", "product"] },
      }),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("index, product");
  });

  it("flags disabled_on templates and group-only enabled_on", () => {
    const disabled = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/custom-liquid.liquid": schema({
        name: "Custom Liquid",
        settings: [LIQUID_SETTING],
        presets: [{ name: "Custom Liquid" }],
        disabled_on: { templates: ["password"] },
      }),
    });
    expect(disabled[0].finding).toContain("disabled on these templates");
    cleanup?.();
    const groupsOnly = findingsFor("SHOPIFY-SECTIONS-CUSTOM-LIQUID-001", {
      "sections/custom-liquid.liquid": schema({
        name: "Custom Liquid",
        settings: [LIQUID_SETTING],
        presets: [{ name: "Custom Liquid" }],
        enabled_on: { groups: ["footer"] },
      }),
    });
    expect(groupsOnly[0].finding).toContain("section groups");
  });
});

describe("SHOPIFY-ARTICLE-EXCERPT-001", () => {
  const articleTemplate = JSON.stringify({ sections: { main: { type: "main-article" } }, order: ["main"] });

  it("flags article.excerpt in the article template's main section and names the toggle", () => {
    const findings = findingsFor("SHOPIFY-ARTICLE-EXCERPT-001", {
      "templates/article.json": articleTemplate,
      "sections/main-article.liquid":
        '<h1>{{ article.title }}</h1>\n{% if section.settings.show_excerpt %}<p>{{ article.excerpt }}</p>{% endif %}\n{% schema %}{"name":"Article","settings":[{"type":"checkbox","id":"show_excerpt","label":"Show excerpt"}]}{% endschema %}',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(2);
    expect(findings[0].finding).toContain('"show_excerpt"');
  });

  it("does not flag excerpt_or_content, commented-out code, or excerpts outside the article page", () => {
    const findings = findingsFor("SHOPIFY-ARTICLE-EXCERPT-001", {
      "templates/article.json": articleTemplate,
      "sections/main-article.liquid": "{{ article.content }}\n{% comment %}{{ article.excerpt }}{% endcomment %}",
      "sections/main-blog.liquid": "{{ article.excerpt }}",
      "snippets/article-card.liquid": "{{ article.excerpt_or_content }} {{ article.excerpt }}",
    });
    expect(findings).toHaveLength(0);
  });
});

describe("SHOPIFY-SWATCH-STABLE-001", () => {
  it("flags a swatch drawn only from value.variant.featured_image", () => {
    const findings = findingsFor("SHOPIFY-SWATCH-STABLE-001", {
      "snippets/product-swatches.liquid":
        "{% for value in option.values %}\n  <label style=\"background-image: url({{ value.variant.featured_image | image_url: width: 60 }})\">{{ value }}</label>\n{% endfor %}",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(2);
  });

  it("flags the same through an assigned alias", () => {
    const findings = findingsFor("SHOPIFY-SWATCH-STABLE-001", {
      "snippets/product-swatches.liquid":
        "{% for option_value in option.values %}\n{% assign v = option_value.variant %}\n<img src=\"{{ v.featured_image | image_url: width: 60 }}\">\n{% endfor %}",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].lineNumber).toBe(3);
  });

  it("does not flag swatches drawn from value.swatch or with a first-available fallback", () => {
    const findings = findingsFor("SHOPIFY-SWATCH-STABLE-001", {
      "snippets/a.liquid": "{% for value in option.values %}{{ value.swatch.image | image_url: width: 50 }}{{ value.variant.featured_image }}{% endfor %}",
      "snippets/b.liquid":
        "{% assign v = value.variant | default: product.selected_or_first_available_variant %}{{ value.variant.featured_image }}",
      "snippets/c.liquid": "{{ product.selected_variant.featured_image }}",
    });
    expect(findings).toHaveLength(0);
  });
});
