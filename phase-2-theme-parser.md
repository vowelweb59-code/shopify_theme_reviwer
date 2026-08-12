# Phase 2 — Theme Parser

**Depends on:** Phase 0 (app shell). Does not depend on Phase 1 — can be built in parallel if useful.
**Goal:** Given a zipped Shopify theme, produce a structured, in-memory representation of every file that later phases (static rules, LLM review) can query without re-parsing raw text themselves.

## Scope

### Input handling
- `/audit` page: file upload for a `.zip` of a theme (from `shopify theme pull` or a local export).
- Unzip server-side to a temp directory, validate it has the expected Shopify theme structure (`sections/`, `snippets/`, `templates/`, `assets/`, `locales/`, `config/`, `layout/`). Reject with a clear error if it doesn't look like a theme.

### File walking
Walk the extracted directory and categorize every file by type:
- `.liquid` files (sections, snippets, templates, layout)
- `.json` files (templates using JSON format, `config/settings_schema.json`, locale files)
- `.css`/`.scss` (or theme's compiled CSS in `assets/`)
- `.js` (in `assets/`)

### Liquid parsing — be realistic about this
A full Liquid AST parser is a heavy lift and mostly unnecessary. Build a **targeted extractor**, not a full language parser:
- Use regex/tokenization to pull out the specific structures the rules need, rather than trying to fully parse Liquid's control flow. Concretely, extract:
  - Every `<img>`, `<svg>`, `<use>`, and icon-font `<i>`/`<span class="icon-*">` element, with its attributes (`alt`, `width`, `height`, `loading`, `src`/Liquid image object reference).
  - Every heading tag (`<h1>`–`<h6>`) with its nesting position in the DOM tree of that file.
  - Every `{% schema %}` block — extract and parse as JSON separately (this is valid JSON already, easy win).
  - Every hardcoded string that looks like user-facing text (for the translation/locale-key check) vs. one already wrapped in `{{ 'key' | t }}`.
  - `<script>` tags in `<head>` vs. deferred/footer placement.
  - `<link rel="canonical">`, `<meta name="description">`, Open Graph tags if present.
  - Any `<script type="application/ld+json">` blocks — extract and parse as JSON.
  - References to deprecated Liquid objects/filters — maintain a lookup list (seed this from Shopify's deprecation docs once ingested in Phase 1, or hardcode a starter list now and refine later).
- If a real Liquid parsing library surfaces during implementation that handles this better than a custom regex approach, use it — but don't let Claude Code sink days into building a general-purpose Liquid interpreter when the rules only need structural extraction, not execution.

### Output shape

Produce one structured object per file:

```ts
type ParsedFile = {
  path: string;                 // "sections/product-form.liquid"
  fileType: 'liquid' | 'json' | 'css' | 'js';
  rawText: string;
  images: { line: number; alt: string | null; hasWidth: boolean; hasHeight: boolean; loading: string | null }[];
  headings: { line: number; level: number }[];
  schemaBlocks: { line: number; json: object | null; parseError: string | null }[];
  jsonLdBlocks: { line: number; json: object | null; parseError: string | null }[];
  hardcodedStrings: { line: number; text: string }[];
  headScripts: { line: number; src: string; deferred: boolean }[];
  metaTags: { canonical: string | null; description: string | null; openGraph: Record<string,string> };
  deprecatedReferences: { line: number; token: string }[];
};
```

This is the object every rule in Phase 3 and every LLM prompt in Phase 4 consumes — get the shape right here so downstream phases don't need to re-touch the parser.

## Acceptance criteria

- Point it at a real theme zip (any of your own themes) and confirm the parsed output for at least 5 files matches what's actually in the source — manually spot-check line numbers and extracted attributes against the raw file.
- Malformed `{% schema %}` JSON is caught and reported as a `parseError`, not a crash.
- A theme missing expected folders is rejected with a clear message rather than silently producing empty results.

## Explicitly out of scope

No rule evaluation, no severity assignment, no LLM calls here. This phase only produces the `ParsedFile[]` array — Phase 3 decides what's wrong with it.
