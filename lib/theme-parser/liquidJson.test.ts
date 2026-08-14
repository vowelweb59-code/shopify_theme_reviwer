import { describe, expect, it } from "vitest";
import { extractLiteralJsonLdTypes, tryParseLiquidJson } from "./liquidJson";

describe("tryParseLiquidJson", () => {
  it("parses plain JSON with no Liquid", () => {
    const { json, parseError } = tryParseLiquidJson('{"@type": "Organization", "name": "Acme"}');
    expect(parseError).toBeNull();
    expect(json).toEqual({ "@type": "Organization", name: "Acme" });
  });

  it("declines to validate a bare | structured_data filter output", () => {
    const { json, parseError } = tryParseLiquidJson("{{ product | structured_data }}");
    expect(parseError).toBeNull();
    expect(json).toBeNull();
  });

  it("repairs Liquid output tags and if/unless conditionals", () => {
    const raw = [
      "{",
      '  "@type": "Product",',
      "  {% if seo_media %}",
      '  "image": {{ seo_media | image_url | json }},',
      "  {% endif %}",
      '  "name": {{ product.title | json }}',
      "}",
    ].join("\n");
    const { json, parseError } = tryParseLiquidJson(raw);
    expect(parseError).toBeNull();
    expect(json).toMatchObject({ "@type": "Product" });
  });

  // Regression test: found auditing a real-world theme (Splash) whose
  // Product JSON-LD builds its offers array with {% for %} + a
  // {% unless forloop.last %},{% endunless %} comma. Our repair only
  // simulates one pass through the loop body, so that per-iteration comma
  // logic becomes an indistinguishable trailing comma — declining to
  // validate is more honest than reporting a fabricated "invalid JSON".
  it("declines to validate JSON-LD built with a {% for %} loop rather than reporting a false trailing-comma error", () => {
    const raw = [
      "{",
      '  "@type": "Product",',
      '  "offers": [',
      "    {%- for variant in product.variants -%}",
      "      {",
      '        "@type": "Offer",',
      '        "price": {{ variant.price | json }}',
      "      }{% unless forloop.last %},{% endunless %}",
      "    {%- endfor -%}",
      "  ]",
      "}",
    ].join("\n");
    const { json, parseError } = tryParseLiquidJson(raw);
    expect(parseError).toBeNull();
    expect(json).toBeNull();
  });

  it("still reports a genuine JSON syntax error with no Liquid involved", () => {
    const { parseError } = tryParseLiquidJson('{ "@type": "Product", }');
    expect(parseError).not.toBeNull();
  });

  it("reports empty blocks as an error", () => {
    const { parseError } = tryParseLiquidJson("   ");
    expect(parseError).toBe("Empty block");
  });
});

describe("extractLiteralJsonLdTypes", () => {
  it("reads a literal @type even when the block also contains a {% for %} loop elsewhere", () => {
    const raw = [
      "{",
      '  "@type": "Product",',
      '  "offers": [',
      "    {%- for variant in product.variants -%}",
      '      { "price": {{ variant.price | json }} }{% unless forloop.last %},{% endunless %}',
      "    {%- endfor -%}",
      "  ]",
      "}",
    ].join("\n");
    expect(extractLiteralJsonLdTypes(raw)).toEqual(["Product"]);
  });

  it("reads multiple types from an @type array", () => {
    expect(extractLiteralJsonLdTypes('{"@type": ["Product", "Thing"]}')).toEqual(["Product", "Thing"]);
  });

  it("returns an empty array when there is no literal @type", () => {
    expect(extractLiteralJsonLdTypes('{"@type": {{ dynamic_type }} }')).toEqual([]);
  });
});
