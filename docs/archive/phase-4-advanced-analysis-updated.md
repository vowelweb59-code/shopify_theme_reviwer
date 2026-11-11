# Phase 4 — Advanced Static Analysis & Audit Quality

**Depends on:** Phases 1–3

**Goal:** Extend the core deterministic auditor beyond simple pattern checks and make the audit more reliable at theme-level and cross-file analysis. This phase replaces the original LLM Review Layer.

The application must remain fully functional without any AI API, embedding provider, Voyage, or external inference service.

Phase 3 establishes individual rules against parsed files. Phase 4 adds the context and analysis required when a rule needs to understand relationships between multiple files, templates, sections, settings, locales, assets, or theme-wide structures.

## Why this phase exists

Some Shopify Theme Store checks cannot be evaluated correctly by looking at one file in isolation.

Examples:

```text
Template
  ↓
references section
  ↓
section references setting
  ↓
setting exists in schema
```

or:

```text
Liquid translation key
  ↓
locale file
  ↓
key exists?
```

or:

```text
asset reference
  ↓
actual asset file
  ↓
file exists?
```

Phase 4 provides the cross-file/theme-level analysis layer needed to evaluate these relationships without introducing an LLM.

## Architecture

The audit pipeline becomes:

```text
Theme ZIP
   ↓
Theme Parser
   ↓
ParsedFile[]
   ↓
Theme Index / Dependency Graph
   ↓
Phase 3 File Rules
   +
Phase 4 Cross-File Rules
   ↓
Finding Deduplication
   ↓
Audit Summary
```

## 1. Build a theme-wide index

After Phase 2 parsing, create a normalized theme index.

Suggested structure:

```ts
type ThemeIndex = {
  filesByPath: Map<string, ParsedFile>;

  liquidFiles: ParsedFile[];
  jsonFiles: ParsedFile[];
  cssFiles: ParsedFile[];
  jsFiles: ParsedFile[];

  sections: Map<string, SectionInfo>;
  snippets: Map<string, SnippetInfo>;
  templates: Map<string, TemplateInfo>;
  assets: Map<string, AssetInfo>;
  locales: Map<string, LocaleInfo>;

  schemaSettings: Map<string, SchemaSettingInfo>;
  translationKeys: Map<string, TranslationKeyInfo>;
  translationReferences: TranslationReferenceInfo[];

  assetReferences: AssetReferenceInfo[];
  sectionReferences: SectionReferenceInfo[];
  snippetReferences: SnippetReferenceInfo[];
  templateReferences: TemplateReferenceInfo[];

  jsonLdBlocks: JsonLdReferenceInfo[];
  metadataByTemplate: Map<string, TemplateMetadata>;
};
```

The index should be built once per audit run and reused by all cross-file rules.

## 2. Section dependency analysis

Build relationships between:

```text
template
  ↓
section
  ↓
schema
  ↓
setting/block
```

Detect:

- References to missing sections
- Invalid section names
- Section settings referenced by Liquid but absent from schema where statically determinable
- Block settings referenced but not declared
- Invalid block references
- Duplicate section identifiers where prohibited
- Inconsistent section configuration
- Invalid preset references

Do not report a missing relationship when Shopify allows dynamic behavior that cannot be resolved statically.

## 3. Snippet dependency analysis

Build a dependency graph for:

```text
file A
  ↓ render/include
file B
  ↓ render/include
file C
```

Detect:

- Missing snippets
- Invalid render/include targets
- Suspicious circular references where statically determinable
- Invalid argument structures where the parser can establish the problem
- Unreachable/orphaned snippets only if the analysis can establish that confidently

Do not treat every unused snippet as a compliance violation.

Unused code may be intentional.

## 4. Asset dependency analysis

Resolve references from Liquid/JSON/CSS/JS where possible.

Detect:

- Missing assets
- Broken asset paths
- Missing referenced CSS
- Missing referenced JS
- Missing image assets
- Missing font assets
- Invalid local module paths

External URLs should not be reported as missing local assets.

Dynamic references that cannot be resolved should be marked as unresolved rather than automatically reported as errors.

## 5. Locale cross-checking

Build a complete index of locale keys and translation references.

Detect:

- Referenced translation key does not exist
- Locale file contains malformed JSON
- Duplicate translation keys where detectable
- Required translation structure missing
- Inconsistent locale key structure where a requirement supports the check

For a key such as:

```liquid
{{ 'products.product.add_to_cart' | t }}
```

the analyzer should be able to determine whether:

```text
products.product.add_to_cart
```

exists in the applicable locale.

Do not judge the quality of translated language.

## 6. Template-level SEO analysis

Phase 3 checks individual heading and metadata structures.

Phase 4 adds template context.

Build a normalized representation of each relevant template:

```text
template
  +
direct markup
  +
rendered snippets
  +
referenced sections
```

Where static expansion is safe, use this context to determine:

- Whether a template has an H1
- Whether multiple H1 sources can occur together
- Whether heading levels are skipped across composed structures
- Whether canonical/meta structures are available
- Whether product/blog/article templates contain the expected technical SEO structures

Do not fully execute Liquid.

If the final runtime structure cannot be determined reliably, report the limitation rather than inventing a violation.

## 7. Template-level structured data analysis

Build a theme-wide map of JSON-LD implementations.

Identify:

- Product schema sources
- Organization schema sources
- Article schema sources
- Breadcrumb schema sources
- Other supported schema types

Connect schemas to the templates/files where possible.

Detect:

- Applicable template missing expected schema
- Duplicate schema implementations
- Conflicting schema implementations where statically identifiable
- JSON-LD blocks that are valid JSON but structurally incomplete according to the configured requirement

Do not perform open-ended semantic interpretation.

## 8. Translation coverage analysis

Compare:

```text
translation references
        ↓
locale definitions
```

and generate coverage statistics.

Example:

```text
Translation references: 842
Resolved keys: 831
Missing keys: 11

Coverage: 98.7%
```

The coverage figure should be informational unless a Shopify requirement explicitly establishes a threshold.

## 9. Configuration consistency analysis

Cross-check:

```text
settings_schema.json
        ↓
theme settings references
```

and:

```text
section schema
        ↓
section setting references
```

Detect:

- References to undefined settings
- Invalid setting IDs
- Invalid defaults where deterministically verifiable
- Incompatible setting types
- Missing declared settings
- Invalid references between configuration structures

## 10. Duplicate and conflict detection

Build theme-wide detection for obvious duplicates.

Examples:

- Duplicate IDs
- Duplicate schema setting IDs
- Duplicate locale keys
- Duplicate asset registrations
- Duplicate script/style inclusion
- Duplicate canonical implementations
- Duplicate JSON-LD implementations

Not every duplicate is an error.

Each finding must be based on a documented rule.

## 11. Cross-file JavaScript analysis

Where practical, add lightweight static analysis for JavaScript.

Check:

- Broken local imports
- Missing local modules
- Syntax errors
- Obvious undefined identifiers where a parser/linter can reliably identify them
- Invalid module paths
- Duplicate initialization patterns where clearly problematic

Do not execute theme JavaScript.

Do not claim to identify runtime bugs that require browser interaction.

## 12. Accessibility cross-file analysis

Build relationships for accessibility checks such as:

```text
label[for]
    ↓
input[id]
```

and:

```text
aria-labelledby
    ↓
element[id]
```

and:

```text
aria-describedby
    ↓
element[id]
```

Detect:

- References to nonexistent IDs
- Duplicate IDs that break accessible relationships
- Label/input mismatches
- Obvious inaccessible component relationships

Where a component is spread across multiple snippets/sections, use the dependency graph before deciding that an ID/reference is missing.

## 13. CSS accessibility analysis

Where CSS can be parsed reliably:

- Identify focus styles
- Identify `:focus-visible`
- Identify rules that remove outlines
- Identify potentially hidden interactive elements
- Calculate contrast when source colors are sufficiently deterministic

Do not make a compliance claim from incomplete CSS information.

For example, if a color is provided through:

```css
color: var(--text-color);
```

and the variable cannot be resolved reliably, mark contrast as indeterminate rather than inventing a ratio.

## 14. Performance structure analysis

Build theme-level checks for:

- Duplicate scripts
- Duplicate stylesheets
- Excessive synchronous head scripts where a requirement applies
- Repeated asset loading
- Obvious duplicate library loading
- Missing defer/async patterns where required
- Large obvious inline payloads only if a defined rule establishes a threshold

Do not estimate actual page speed.

Do not calculate Lighthouse scores.

Do not calculate Core Web Vitals.

Those require browser/runtime testing and are outside this static application.

## 15. Rule confidence

Not every static analysis result has the same certainty.

Internally, support:

```ts
type FindingConfidence =
  | 'high'
  | 'medium'
  | 'low';
```

Recommended usage:

### High

The source proves the violation.

Example:

```text
Referenced snippet does not exist.
```

### Medium

The static source strongly indicates a problem but runtime context may affect it.

### Low

The analyzer cannot confidently establish the behavior.

Low-confidence results should generally not be blockers.

The UI can display confidence when useful.

## 16. False-positive controls

Phase 4 must prioritize precision.

Examples:

### Dynamic references

Do not report:

```liquid
{% render section.settings.snippet_name %}
```

as a missing snippet if the target is dynamic and cannot be statically resolved.

### Conditional rendering

Do not assume two conditional H1s are simultaneously rendered without analyzing their conditions.

### Reusable components

Do not report a section as broken simply because its dependencies are resolved through another file.

### External assets

Do not report external URLs as missing local assets.

### Optional structures

Do not report optional Shopify functionality as missing unless the requirement applies to the current template/theme configuration.

## 17. Audit diagnostics

In addition to findings, Phase 4 should produce internal audit diagnostics.

Examples:

```text
Parser warnings: 3
Unresolved dynamic references: 14
Files skipped: 0
Rules skipped due to insufficient data: 5
```

These diagnostics help distinguish:

```text
No issue found
```

from:

```text
Could not reliably analyze
```

This is important for audit trustworthiness.

## 18. Analysis caching

The theme index and cross-file dependency graph should be created once per audit run.

Do not rebuild them for every rule.

Suggested flow:

```text
Parse once
   ↓
Build index once
   ↓
Build dependency graph once
   ↓
Run all rules
```

This keeps the local audit fast.

## 19. Test fixtures

Create reusable test themes/fixtures representing:

### Valid theme

No expected findings.

### Broken schema

Malformed section schema.

### Missing translation

Liquid references a nonexistent locale key.

### Broken asset

Liquid references a nonexistent asset.

### Broken snippet

Render references a nonexistent snippet.

### Duplicate IDs

Two elements use the same ID where that causes a relationship problem.

### H1 problems

- No H1
- Two H1s
- Skipped heading level

### JSON-LD problems

- Missing Product schema
- Malformed JSON
- Incomplete schema structure

### Accessibility relationships

- Missing label
- Broken `aria-labelledby`
- Broken `aria-describedby`

### Dynamic theme

Contains dynamic Liquid references that must not create false positives.

## 20. Real-theme validation

Run the complete parser + Phase 3 + Phase 4 pipeline against several real Shopify themes.

For each theme:

1. Record total findings.
2. Sample findings from every category.
3. Verify findings against source.
4. Check for false positives.
5. Check for important false negatives.
6. Review unresolved/dynamic references.
7. Confirm that audit diagnostics accurately describe analysis limitations.

The goal is not to maximize finding count.

The goal is:

> **High-confidence, actionable findings with minimal false positives.**

## 21. Performance targets

The complete static analysis should remain practical for real Shopify themes.

Targets:

- Parse each file once.
- Build the theme index once.
- Build cross-file dependencies once.
- Avoid repeated disk reads.
- Avoid network requests.
- Avoid external services.
- Run rules against in-memory structures.

The system should provide timing information for:

```text
ZIP extraction
Parsing
Index construction
Cross-file analysis
Rule execution
Finding persistence
```

This makes future optimization straightforward.

## 22. Acceptance criteria

Phase 4 is complete when:

- A theme-wide index is generated successfully.
- Section dependencies can be resolved where statically determinable.
- Snippet dependencies can be resolved.
- Asset references can be checked.
- Locale references can be cross-checked.
- Template-level heading/metadata analysis works where static composition can be established.
- JSON-LD implementations can be mapped to relevant templates.
- Configuration references can be cross-checked.
- Accessibility relationships across files can be checked.
- Cross-file JavaScript imports can be checked where supported.
- Duplicate/conflict analysis works for configured rule types.
- Dynamic/unresolvable references do not create false positives.
- Audit diagnostics distinguish analysis limitations from successful passes.
- Theme index/dependency graph is reused across rules.
- Real Shopify themes have been tested.
- Findings are manually validated.
- No AI API is required.
- No Voyage API is required.
- No embeddings/vector search is required.

## Explicitly out of scope

Do not build:

- Claude integration
- OpenAI integration
- Any external LLM
- Voyage
- Embeddings
- Vector database
- RAG
- Browser execution
- Lighthouse
- PageSpeed Insights
- Core Web Vitals measurement
- Runtime Liquid execution
- Runtime JavaScript execution
- Merchant-content SEO analysis
- Content quality scoring
- Google Sheets export
- Re-audit/diff UI
- Submission-readiness UI

Those belong to later phases.
