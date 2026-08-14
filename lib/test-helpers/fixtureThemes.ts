// Canonical reusable test fixtures (phase-4 §19) — one theme per named
// real-world failure category, run through the FULL rule pipeline in
// fixtureThemes.test.ts. Distinct from the many isolated per-rule unit
// tests scattered across lib/rules/**/*.test.ts: those verify one rule in
// isolation; these verify the pipeline reacts correctly to a coherent
// theme exhibiting each named scenario end to end.
//
// Each fixture is deliberately minimal — just enough to exercise the
// scenario it's named for, not a realistic full theme.

const BASE_LAYOUT = {
  "layout/theme.liquid": '<!doctype html><html lang="{{ request.locale.iso_code }}"><head></head><body>{{ content_for_layout }}</body></html>',
  "config/settings_schema.json": "[]",
  "locales/en.default.json": '{"general": {"welcome": "Welcome"}}',
};

export const FIXTURE_THEMES: Record<string, Record<string, string>> = {
  // A small but complete, well-formed theme. Not literally zero findings
  // across every presence/best-practice rule (a minimal fixture can't
  // plausibly carry every Shopify feature) — see fixtureThemes.test.ts for
  // what "valid" is actually asserted to mean here.
  validTheme: {
    ...BASE_LAYOUT,
    "layout/theme.liquid":
      '<!doctype html><html lang="{{ request.locale.iso_code }}"><head><link rel="canonical" href="{{ canonical_url }}"><meta name="description" content="A valid theme"></head><body>{{ content_for_layout }}</body></html>',
    "templates/index.json": JSON.stringify({ sections: { hero: { type: "hero" } }, order: ["hero"] }),
    "sections/hero.liquid": '{% schema %}{"name": "Hero", "settings": []}{% endschema %}<h1>{{ \'general.welcome\' | t }}</h1>',
  },

  // Malformed JSON inside a {% schema %} tag — SCHEMA-JSON-VALID-001.
  brokenSchemaTheme: {
    ...BASE_LAYOUT,
    "sections/hero.liquid": '{% schema %}{"name": "Hero", "settings": [}{% endschema %}<h1>Hero</h1>',
  },

  // A `| t` filter referencing a key absent from the default locale file —
  // REF-LOCALE-KEY-MISSING-001.
  missingTranslationTheme: {
    ...BASE_LAYOUT,
    "sections/hero.liquid": "<p>{{ 'general.does_not_exist' | t }}</p>",
  },

  // asset_url referencing a file not present in assets/ — REF-ASSET-MISSING-001.
  brokenAssetTheme: {
    ...BASE_LAYOUT,
    "sections/hero.liquid": "{{ 'missing.js' | asset_url }}",
  },

  // {% render %} referencing a snippet that doesn't exist — REF-SNIPPET-MISSING-001.
  brokenSnippetTheme: {
    ...BASE_LAYOUT,
    "sections/hero.liquid": "{% render 'does-not-exist' %}",
  },

  // Two settings in the same {% schema %} declaring the same id — only the
  // last is ever used, silently dropping the other. SCHEMA-DUPLICATE-ID-001.
  duplicateIdsTheme: {
    ...BASE_LAYOUT,
    "sections/hero.liquid":
      '{% schema %}{"name": "Hero", "settings": [{"type": "text", "id": "heading"}, {"type": "text", "id": "heading"}]}{% endschema %}',
  },

  // Three separate problems, each isolated to its own template so the
  // pipeline's composed heading checks (phase-4 §6) can be exercised
  // without one scenario masking another: no H1 anywhere in the template's
  // composed sections (SEO-H1-MISSING-COMPOSED-001), two sections each
  // rendering their own H1 (SEO-H1-MULTIPLE-COMPOSED-001), and a heading
  // level skipped within one section (A11Y-HEADING-SKIP-001).
  h1ProblemsTheme: {
    ...BASE_LAYOUT,
    "templates/index.json": JSON.stringify({ sections: { hero: { type: "no-h1" } }, order: ["hero"] }),
    "sections/no-h1.liquid": "<div>No heading here</div>",
    "templates/product.json": JSON.stringify({ sections: { a: { type: "h1-a" }, b: { type: "h1-b" } }, order: ["a", "b"] }),
    "sections/h1-a.liquid": "<h1>First</h1>",
    "sections/h1-b.liquid": "<h1>Second</h1>",
    "templates/page.json": JSON.stringify({ sections: { c: { type: "skip-heading" } }, order: ["c"] }),
    "sections/skip-heading.liquid": "<h1>Title</h1><h3>Skips h2</h3>",
  },

  // Missing Product schema anywhere in the theme (AEO-PRODUCT-SCHEMA-001)
  // and a malformed <script type="application/ld+json"> block elsewhere
  // (AEO-JSONLD-VALID-001). "Incomplete schema structure" (missing
  // required fields like offers/name on an otherwise-valid Product block)
  // has no dedicated rule yet — not asserted here; see the phase-4 gap
  // analysis rather than pretending coverage that doesn't exist.
  jsonLdProblemsTheme: {
    ...BASE_LAYOUT,
    "templates/product.json": JSON.stringify({ sections: { main: { type: "main-product" } }, order: ["main"] }),
    "sections/main-product.liquid": "<h1>{{ product.title }}</h1>",
    "sections/broken-jsonld.liquid": '<script type="application/ld+json">{ not valid json</script>',
  },

  // Missing label (SHOPIFY-A11Y-LABEL-001), a broken aria-labelledby, and a
  // broken aria-describedby (both REF-ARIA-ID-MISSING-001) — checked
  // theme-wide since the referenced id is routinely defined in a different
  // file than the element referencing it.
  accessibilityRelationshipsTheme: {
    ...BASE_LAYOUT,
    "sections/form.liquid":
      '<input type="text" id="email" name="email">' +
      '<div aria-labelledby="missing-label-id">Section</div>' +
      '<div aria-describedby="missing-desc-id">More detail</div>',
  },

  // Dynamic (non-literal) section/snippet references must never be
  // reported as broken — the parser can't know what they resolve to
  // without executing Liquid, so it marks them `dynamic` and the
  // reference-integrity rules skip them entirely rather than guessing.
  dynamicThemeTheme: {
    ...BASE_LAYOUT,
    "sections/hero.liquid": "{% render snippet_name %}{% section section_name %}",
  },
};
