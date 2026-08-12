# Phase 2 — Shopify Theme Parser

**Depends on:** Phase 0 (application foundation) and Phase 1 (requirements knowledge base)

**Goal:** Given a Shopify theme ZIP, extract and structure the code information required by the audit engine. The parser must provide enough reliable, line-aware data for the Shopify Theme Store compliance rules, accessibility checks, technical SEO checks, technical AEO/schema checks, bug checks, and internal standards.

The parser does **not** decide whether something is wrong. It only extracts facts from the theme. Phase 3 and later rule groups decide what those facts mean.

## Scope

### Input handling

The `/audit` page must support uploading a `.zip` Shopify theme.

The server must:

1. Receive the ZIP.
2. Validate that it is a ZIP.
3. Extract it to a temporary working directory.
4. Validate that it resembles a Shopify theme.
5. Reject invalid packages with a clear, actionable error.
6. Prevent unsafe archive extraction such as path traversal.
7. Record the uploaded theme name and create an audit run.
8. Pass the extracted files to the parser.

Expected Shopify theme directories may include:

```text
assets/
config/
layout/
locales/
sections/
snippets/
templates/
```

Do not assume that every valid theme must contain every possible file. The parser should validate the overall theme structure while allowing legitimate Shopify variations.

## File discovery

Walk the extracted theme recursively and classify supported files.

### Liquid

Parse:

```text
*.liquid
```

Typical locations:

```text
layout/
sections/
snippets/
templates/
```

### JSON

Parse:

```text
*.json
```

Including, where present:

```text
templates/
config/
locales/
```

### CSS / SCSS

Parse:

```text
*.css
*.scss
```

### JavaScript

Parse:

```text
*.js
```

Other files should be retained as discovered metadata where useful, but the parser should only perform structured extraction for supported file types.

## Parser design principle

Do not attempt to build a complete Liquid interpreter.

The parser should be a **targeted structural extractor**.

Use robust tokenization, parsing libraries, or carefully designed regexes only where appropriate. The goal is to extract facts required by the rule engine rather than execute Liquid or emulate Shopify's runtime.

If a real parser/library provides more reliable extraction for a specific structure, prefer it over increasingly complex regular expressions.

## Parsed file model

Produce one structured object for every supported file.

Suggested structure:

```ts
type ParsedFile = {
  path: string;

  fileType: 'liquid' | 'json' | 'css' | 'js';

  rawText: string;

  lineCount: number;

  images: ParsedImage[];

  svgElements: ParsedSvg[];

  iconElements: ParsedIcon[];

  headings: ParsedHeading[];

  links: ParsedLink[];

  buttons: ParsedButton[];

  forms: ParsedForm[];

  inputs: ParsedInput[];

  labels: ParsedLabel[];

  interactiveElements: ParsedInteractiveElement[];

  schemaBlocks: ParsedSchemaBlock[];

  jsonLdBlocks: ParsedJsonLdBlock[];

  hardcodedStrings: ParsedString[];

  translationReferences: ParsedTranslationReference[];

  scripts: ParsedScript[];

  stylesheets: ParsedStylesheet[];

  metaTags: ParsedMetaTags;

  liquidTags: ParsedLiquidTag[];

  liquidObjects: ParsedLiquidReference[];

  deprecatedReferences: ParsedDeprecatedReference[];

  assetReferences: ParsedAssetReference[];

  sectionReferences: ParsedSectionReference[];

  localeReferences: ParsedLocaleReference[];

  settingReferences: ParsedSettingReference[];

  linksToFiles: ParsedFileReference[];

  parseErrors: ParsedParseError[];
};
```

Every extracted item that can be tied to source code should contain at least:

```ts
type SourceLocation = {
  line: number;
  column?: number;
};
```

Where practical, preserve a short source snippet as well.

## 1. Images

Extract every relevant image element/object reference.

Capture:

```ts
type ParsedImage = {
  line: number;
  tag?: 'img' | 'image';
  alt: string | null;
  altSource?: 'literal' | 'liquid' | 'missing' | 'empty';
  hasWidth: boolean;
  hasHeight: boolean;
  loading: string | null;
  src?: string;
  sourceExpression?: string;
  lazyLoadPattern?: string;
  isLikelyDecorative: boolean;
};
```

The parser should distinguish:

```html
alt=""
```

from:

```html
(no alt attribute)
```

because an intentionally decorative image may legitimately use an empty alt attribute.

Do not decide whether an existing alt value is good or bad in Phase 2.

## 2. SVG and icon extraction

Extract:

- Inline SVG
- `<use>`
- Icon-font `<i>`
- Icon spans/classes
- SVG title/accessible labeling patterns
- `aria-hidden`
- `role`
- accessible name-related attributes

This gives accessibility rules enough information to evaluate icon implementations.

## 3. Headings

Extract every:

```html
<h1>
<h2>
<h3>
<h4>
<h5>
<h6>
```

Capture:

```ts
type ParsedHeading = {
  line: number;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text?: string;
  sourceExpression?: string;
};
```

The parser should preserve enough context for later rules to determine:

- Missing H1
- Multiple H1
- Skipped heading levels
- Incorrect heading hierarchy

Do not assign SEO findings during parsing.

## 4. Links, buttons and interactive elements

Extract:

- `<a>`
- `<button>`
- Elements with click handlers
- Elements with common interactive roles
- Elements using keyboard handlers
- `tabindex`
- `role`
- `aria-*`
- disabled states
- href/action targets

Capture enough structure to support accessibility and code-quality rules.

Do not attempt to prove full runtime keyboard accessibility from static parsing alone. Mark information as unavailable where runtime behavior cannot be determined.

## 5. Forms, inputs and labels

Extract:

- `<form>`
- `<input>`
- `<select>`
- `<textarea>`
- `<button>`
- `<label>`

Capture:

```ts
type ParsedInput = {
  line: number;
  type?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  required?: boolean;
};

type ParsedLabel = {
  line: number;
  for?: string;
  text?: string;
};
```

This allows the rule engine to detect missing or incorrectly associated labels.

## 6. Shopify `{% schema %}` blocks

Extract every:

```liquid
{% schema %}
...
{% endschema %}
```

Parse the contents as JSON.

Capture:

```ts
type ParsedSchemaBlock = {
  line: number;
  endLine?: number;
  json: object | null;
  parseError: string | null;
  rawJson: string;
};
```

Malformed JSON must produce a `parseError` rather than crashing the entire audit.

The parser should preserve the raw schema so rules can report the exact location and useful context.

## 7. Shopify schema structure

Where JSON parsing succeeds, extract useful schema-level information such as:

- Section name
- Presets
- Settings
- Blocks
- Block types
- IDs
- Setting types
- Defaults
- Labels
- Options
- Limits
- Dynamic source declarations where detectable

This information will support Theme Store compliance and internal architecture rules.

## 8. JSON-LD

Extract every:

```html
<script type="application/ld+json">
```

block.

Capture:

```ts
type ParsedJsonLdBlock = {
  line: number;
  endLine?: number;
  json: unknown | null;
  parseError: string | null;
  rawJson: string;
  types: string[];
};
```

The parser must distinguish:

```text
valid JSON-LD
```

from:

```text
invalid JSON
```

It should also identify common schema types such as:

```text
Product
Organization
Article
BreadcrumbList
WebSite
```

Do not decide semantic correctness during parsing.

## 9. Metadata

Extract relevant metadata from Liquid/layout files.

Capture:

- `<title>`
- `<meta name="description">`
- `<link rel="canonical">`
- Open Graph tags
- Twitter/card metadata where relevant
- Robots-related metadata
- Language attributes
- Other clearly relevant head metadata

Example:

```ts
type ParsedMetaTags = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  robots: string | null;
  htmlLang: string | null;
};
```

Do not evaluate content quality.

The purpose is to determine whether the required structural implementation exists.

## 10. Translation and localization extraction

Extract:

- `{{ 'key' | t }}`
- `{{ 'key' | translate }}`
- Locale key references
- Hardcoded user-facing strings
- Locale file keys
- References to locale files

The parser should distinguish likely user-facing strings from code, variables, CSS, URLs, technical identifiers, and other non-translatable content.

Where possible, capture:

```ts
type ParsedTranslationReference = {
  line: number;
  key: string;
  filter: string;
};

type ParsedString = {
  line: number;
  text: string;
  confidence: 'high' | 'medium' | 'low';
};
```

Phase 3 will decide whether a string actually violates localization requirements.

## 11. Scripts and performance-related structures

Extract all script tags and relevant attributes.

Capture:

- Location: head/body/footer
- `src`
- inline/external
- `async`
- `defer`
- module type
- preload/preconnect-related references where detectable

Example:

```ts
type ParsedScript = {
  line: number;
  src: string | null;
  inline: boolean;
  location: 'head' | 'body' | 'unknown';
  async: boolean;
  defer: boolean;
  type?: string;
};
```

This supports deterministic performance and Theme Store technical checks.

Do not attempt to calculate actual Core Web Vitals from source code alone.

## 12. Stylesheets and CSS

Extract:

- Stylesheet references
- Inline style blocks
- CSS/SCSS files
- Color declarations where reliably parseable
- `:focus` rules
- `:focus-visible` rules
- `display:none`/visibility patterns where relevant
- media queries
- potentially relevant accessibility styles

Where feasible, create a normalized CSS representation so later rules can inspect it.

Do not claim to perform a full browser rendering or Lighthouse audit from static source alone.

## 13. Liquid references

Extract references to:

- Liquid objects
- Filters
- Tags
- Includes
- Renders
- Snippets
- Section rendering
- Theme settings
- Translation keys
- Asset references

Maintain line numbers for each reference.

This supports deprecated-reference detection and structural validation.

## 14. Deprecated Shopify references

Maintain a versioned lookup of deprecated Liquid objects/filters/tags.

The parser should report:

```ts
type ParsedDeprecatedReference = {
  line: number;
  token: string;
  referenceType: 'object' | 'filter' | 'tag' | 'other';
};
```

The parser identifies occurrences.

The rule engine determines severity and whether the reference is actually prohibited.

## 15. Asset and file references

Extract references to:

- Images
- CSS
- JavaScript
- Fonts
- Snippets
- Sections
- Templates
- Locale keys
- Other theme files

This allows later rules to identify broken references and missing dependencies.

## 16. JSON templates and configuration

For JSON templates and configuration files, parse and expose:

- Section references
- Section IDs
- Block definitions
- Settings
- Template types
- Preset/configuration structures
- JSON parse errors
- References to missing sections where statically determinable

Malformed JSON must be reported as parser data, not cause the entire audit to fail.

## 17. Locale files

Parse locale JSON files and expose:

- Locale name/path
- Translation keys
- Values
- Duplicate keys if detectable
- JSON parse errors
- Missing/invalid structures

The rule engine can later compare translation references against locale keys.

## Parser output storage

The complete `ParsedFile[]` representation does not need to be permanently stored in MongoDB for the first version.

Prefer:

```text
ZIP
 ↓
Temporary extraction
 ↓
ParsedFile[]
 ↓
Rule engine
 ↓
Findings
```

Store the final audit findings and metadata in MongoDB.

If performance or debugging later requires persistence, parsed file snapshots can be added as an optional feature.

## Parser error handling

The parser must distinguish between:

### File-level parse error

Example:

```text
Invalid JSON in templates/product.json
```

The audit should continue where possible.

### Theme-level validation error

Example:

```text
ZIP does not contain a recognizable Shopify theme structure.
```

The audit should stop because there is no valid theme to analyze.

### Unsupported structure

Example:

```text
Unable to statically determine whether this custom JavaScript
component provides keyboard navigation.
```

This should not be turned into a false finding.

Record the limitation where useful and allow the audit to continue.

## Security requirements

ZIP processing must:

- Prevent path traversal
- Prevent extraction outside the temporary directory
- Apply reasonable file-size limits
- Apply reasonable archive-size/file-count limits
- Clean up temporary files
- Reject malformed archives safely
- Never execute theme JavaScript/Liquid during parsing

The parser must treat the theme as untrusted source code.

## Parser testing

Use real Shopify themes for parser validation.

At minimum, manually verify parsed output against at least 5 representative files from a real theme.

Test:

- Liquid
- JSON templates
- Section schema
- Locale files
- JavaScript/CSS
- JSON-LD
- Images
- Headings
- Translation references
- Script attributes

Line numbers and extracted attributes must match the original source.

## Acceptance criteria

- A valid Shopify theme ZIP can be uploaded and extracted.
- Invalid/non-theme ZIPs are rejected with a clear error.
- ZIP path traversal is prevented.
- The parser discovers supported files recursively.
- At least 5 real theme files are manually spot-checked against parser output.
- Images are extracted with line numbers and relevant attributes.
- Empty `alt=""` is distinguishable from missing `alt`.
- Heading levels are extracted correctly.
- Forms, inputs, labels, links, buttons, and interactive attributes are extracted.
- Shopify `{% schema %}` blocks are extracted and parsed.
- Malformed schema JSON produces a parse error without crashing the audit.
- JSON-LD blocks are extracted and validated as JSON.
- Metadata and canonical structures are extracted.
- Translation references and likely hardcoded user-facing strings are extracted.
- Scripts are classified by location and defer/async state.
- Deprecated Liquid references can be identified from the configured lookup list.
- Asset/file references are extracted where statically determinable.
- Locale files are parsed.
- Parser errors do not unnecessarily stop the entire audit.
- The parser performs no rule evaluation.
- The parser performs no severity assignment.
- The parser makes no content-quality judgments.
- No AI/API calls are required.

## Important scope boundaries

This parser must support the following audit philosophy:

```text
Theme ZIP
    ↓
Extract code/structure
    ↓
Identify facts
    ↓
Rules determine compliance
```

It must NOT attempt to determine:

```text
"Is this product description good?"
"Is this marketing copy persuasive?"
"Is this keyword optimized?"
"Will this page rank well?"
"Is this actual merchant content high quality?"
```

The theme ZIP does not contain the merchant's real storefront data, so content-level SEO judgments are outside the product scope.

## Explicitly out of scope

- Static rule evaluation
- Shopify compliance decisions
- Severity assignment
- AI/LLM review
- Voyage API
- OpenAI API
- Embeddings
- Vector search
- RAG
- Google Sheets
- Re-audit/diff
- Submission-readiness calculation
- Runtime browser execution
- Full Liquid execution/interpreter
- Full Lighthouse/PageSpeed testing
- Merchant-content SEO scoring
