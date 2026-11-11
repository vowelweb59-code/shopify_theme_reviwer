# Phase 3 — Shopify Theme Store Compliance & Static Rules Engine

**Depends on:** Phase 1 (requirements and rule definitions) and Phase 2 (parsed theme output)

**Goal:** Build the deterministic audit engine that evaluates a parsed Shopify theme against the structured requirements and produces accurate, traceable `Finding` records.

This is the core of the application.

The engine must prioritize **Shopify Theme Store compliance** and then cover structural Accessibility, Technical SEO, Technical AEO, Bug checks, and Internal Standards.

No AI or external API is required in this phase.

## Core principle

Every automated rule must answer:

> "Is this requirement objectively satisfied by the theme code/structure?"

Rules must be deterministic and independently testable.

The flow is:

```text
Shopify Requirement
        ↓
Executable Rule
        ↓
ParsedFile / Parsed Theme
        ↓
Pass / Fail
        ↓
Finding
```

A rule must never invent a Shopify requirement.

Every Shopify compliance rule must reference the requirement it implements.

## Rule classification

Every rule belongs to one of:

```ts
type FindingCategory =
  | 'Theme Store Compliance'
  | 'Accessibility'
  | 'Technical SEO'
  | 'Technical AEO'
  | 'Bug'
  | 'Internal Standard';
```

Use `Theme Store Compliance` only when the rule is based on an authoritative Shopify requirement.

Use other categories for technical checks and best practices that are not explicitly Shopify rejection criteria.

## Rule shape

Use a pure, independently testable rule interface.

```ts
type RuleContext = {
  files: ParsedFile[];
  theme: ParsedTheme;
  requirements: Requirement[];
};

type Rule = {
  ruleId: string;
  requirementId?: string;
  category: FindingCategory;
  defaultSeverity: 'blocker' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sourceReference?: string;
  sourceUrl?: string;

  check: (
    context: RuleContext
  ) => Omit<
    Finding,
    'id' | 'auditRunId' | 'createdAt'
  >[];
};
```

Rules must not share mutable state.

## Rule execution

The engine should:

1. Load enabled rules.
2. Load the parsed theme.
3. Run each relevant rule.
4. Collect findings.
5. Deduplicate findings where multiple rules identify the exact same violation.
6. Attach the rule ID and requirement ID.
7. Store findings in MongoDB.
8. Calculate summary counts.

A failure in one rule must not crash the complete audit.

## Rule priority

The implementation order should be:

```text
1. Shopify Theme Store Compliance
2. Accessibility
3. Technical SEO
4. Technical AEO
5. Bug checks
6. Internal Standards
```

Shopify compliance must receive the most comprehensive rule coverage.

---

# 1. Shopify Theme Structure & Package Rules

Build rules for requirements that can be determined from the theme package itself.

Examples include:

- Required Shopify theme directories where required
- Required configuration structures
- Valid theme file organization
- Valid template structures
- Valid section/snippet references
- Missing referenced files
- Invalid template references
- Invalid asset references
- Invalid locale references
- Invalid configuration references

Do not reject a theme merely because a directory is absent if Shopify permits a valid theme to omit it.

Rules must be based on the requirement records created in Phase 1.

---

# 2. Shopify Liquid Rules

Check objectively verifiable Liquid implementation issues.

Examples:

- Deprecated Liquid objects
- Deprecated filters
- Deprecated tags
- Invalid/unsupported references where detectable
- Invalid Liquid structures where the parser can reliably identify them
- Broken snippet references
- Broken render/include references
- Broken section references
- Invalid object/setting references where statically determinable

Deprecated references should be severity-mapped using the corresponding Shopify requirement.

Do not attempt to execute Liquid.

---

# 3. Shopify Section & Schema Rules

This is a major compliance area.

Check:

### Schema validity

- Missing schema where required
- Malformed `{% schema %}` JSON
- Invalid schema structure
- Invalid setting definitions
- Invalid block definitions
- Invalid preset structures
- Invalid defaults
- Invalid IDs
- Duplicate IDs
- Invalid setting types
- Invalid option structures
- Invalid references where deterministically verifiable

Malformed schema JSON should be a `blocker` when it makes the section invalid.

### Section structure

Check:

- Section references
- Block definitions
- Section settings
- Presets
- Template/section compatibility
- Missing referenced sections

Do not mark something invalid merely because it is uncommon. The rule must have a documented requirement.

---

# 4. Localization / Translation Rules

Localization is a major Theme Store compliance area.

Detect:

- Hardcoded user-facing strings
- Missing translation filters
- Missing locale keys
- Translation references to missing keys
- Invalid locale JSON
- Locale structure problems
- Inconsistent translation references

The parser's confidence level for hardcoded strings must be respected.

A rule should not automatically report a low-confidence string as a compliance failure.

For example:

```text
High confidence:
"Add to cart"

Low confidence:
some_variable_or_identifier
```

Only actual user-facing strings should become compliance findings.

---

# 5. Accessibility Rules

Accessibility is a core audit category.

## Images

Check:

- Missing `alt`
- Invalid/missing accessible labeling for relevant images
- Decorative images using `alt=""` should not be falsely flagged
- Image/icon patterns that clearly lack accessible treatment

Missing alt should be `blocker` only when the applicable requirement establishes that severity.

## Forms

Check:

- Inputs without associated labels
- Incorrect `for`/`id` relationships
- Missing accessible names
- Missing labels on relevant form controls

## HTML language

Check:

- Missing `<html lang="">`

## Interactive elements

Where deterministically verifiable, check:

- Buttons without accessible names
- Links without meaningful accessible names where statically determinable
- Invalid role patterns
- `aria-*` references to missing IDs
- Invalid `aria-hidden` patterns
- Interactive elements made inaccessible through obvious static attributes
- Missing focus-related structures where the applicable requirement explicitly requires them

Do not claim that static source proves complete keyboard accessibility. Only report objectively identifiable implementation problems.

## SVG and icons

Check:

- Decorative icons lacking appropriate hidden semantics
- Informational icons without accessible naming where required
- SVGs with conflicting accessibility attributes

## Contrast

If CSS parsing allows reliable WCAG contrast calculation:

- Calculate it.

If reliable calculation is not possible:

- Do not invent a precise contrast ratio.
- Report only what can be verified.
- If needed, classify the check as a lower-confidence best-practice warning rather than a compliance blocker.

---

# 6. Technical SEO Rules

SEO is **structural only**.

The theme ZIP does not contain the merchant's real content, so this application must not perform content-quality SEO analysis.

## Heading rules

Check:

- Missing H1 where an H1 is required for the relevant template/page structure
- Multiple H1 elements
- Skipped heading levels
- Invalid heading hierarchy
- Heading structures that are clearly inconsistent across the relevant template

Be careful with reusable sections.

A section containing an H1 is not automatically a violation merely because another template section may also contain one. The rule must evaluate the appropriate template context where the parser can establish it.

## Metadata rules

Check:

- Missing canonical structure
- Missing meta description structure on applicable templates
- Missing title structure
- Relevant Open Graph structure where required by the configured rule

Do not judge the quality of actual metadata copy.

## Images

Check:

- Missing alt
- Missing width
- Missing height
- Missing lazy loading for applicable below-the-fold images

Do not report an image as a content SEO problem.

## Explicitly excluded SEO checks

Do not evaluate:

- Keyword density
- Product title quality
- Product description quality
- Meta description copy quality
- Collection content
- Blog content quality
- Search rankings
- Content depth
- Merchant-specific SEO performance

---

# 7. Technical AEO / Structured Data Rules

AEO is also **structural/implementation focused**.

## Product schema

Check applicable product templates for:

- Product JSON-LD presence
- Valid JSON
- Correct schema type
- Meaningful dynamic Shopify references where statically verifiable
- Placeholder/hardcoded values where clearly invalid
- Required structural fields where applicable

## Organization schema

Check for Organization schema where required/configured.

## Article schema

Check applicable blog/article templates for Article schema.

## JSON-LD validity

A malformed JSON-LD block is a `blocker` when it breaks the structured-data implementation.

Do not confuse:

```text
valid JSON
```

with:

```text
correct semantic schema
```

Static rules verify structure and objectively detectable problems.

Do not attempt broad AI-like semantic interpretation in this phase.

---

# 8. Script & Performance-Related Static Rules

Check objectively identifiable technical issues.

Examples:

- Render-blocking scripts in `<head>` without `defer`/`async`
- Invalid script references
- Duplicate script loading where deterministically detectable
- Unnecessary duplicate stylesheet references
- Missing loading attributes where an explicit requirement exists
- Obvious asset-loading mistakes

Do not claim to calculate:

- Core Web Vitals
- LCP
- CLS
- INP
- Real browser performance
- Network waterfall performance

Those require runtime/browser testing and are outside the static rule engine.

---

# 9. Asset & Reference Integrity Rules

Check:

- Missing referenced assets
- Missing snippets
- Missing sections
- Missing templates
- Missing locale keys
- Broken references
- Invalid file paths
- Invalid section rendering references
- Invalid setting references where deterministically verifiable

These should generally be `high` or `medium` unless the associated Shopify requirement establishes a different severity.

---

# 10. Theme Configuration Rules

Check:

- Invalid `settings_schema.json`
- Invalid configuration JSON
- Invalid setting structures
- Duplicate setting IDs
- Invalid references
- Broken defaults
- Configuration values incompatible with the declared schema where statically verifiable

Do not treat every unusual configuration choice as a violation.

---

# 11. JavaScript / Code Integrity Rules

Implement deterministic checks for obvious code-level problems.

Examples:

- Syntax errors where a JavaScript parser can reliably detect them
- Invalid imports/references where statically determinable
- Missing local modules
- Duplicate event registration patterns where confidently detectable
- Obvious undefined references where the static analyzer can establish them
- Broken asset/module paths

Do not attempt to prove application behavior without executing the theme.

---

# 12. Internal Standards Rules

The rule engine must support the team's own rules independently from Shopify.

Examples:

```text
INTERNAL-UX-001
Product cards should support the approved quick-add pattern.

INTERNAL-A11Y-001
Drawers must implement the approved keyboard/focus pattern.

INTERNAL-PERF-001
Third-party scripts should not be loaded unnecessarily.

INTERNAL-ARCH-001
Sections should follow the approved schema/component architecture.
```

These must be classified as:

```text
Internal Standard
```

and must never be reported as Shopify Theme Store violations unless there is a separate Shopify requirement supporting the same finding.

---

# 13. Severity model

Use:

```text
blocker
high
medium
low
```

Recommended interpretation:

### Blocker

The theme has an objectively invalid or compliance-critical implementation that should prevent submission.

Examples may include:

- Malformed required schema JSON
- Invalid critical JSON-LD
- Certain Shopify-required accessibility failures

Only assign `blocker` when the requirement/source supports it.

### High

Important Theme Store compliance or significant technical problem.

### Medium

Meaningful issue that should be corrected.

### Low

Best-practice or lower-risk issue.

Do not inflate severity to make the report look more serious.

---

# 14. Source traceability

Every Shopify compliance finding must be traceable:

```text
Finding
 ↓
Rule ID
 ↓
Requirement ID
 ↓
Shopify source
```

Example:

```text
Rule:
A11Y-IMG-ALT-001

Requirement:
SHOPIFY-A11Y-001

Finding:
Image is missing alt attribute.

Source:
Shopify Theme Store accessibility requirement
```

The user should be able to open/view the source reference from the finding details.

---

# 15. False-positive prevention

Accuracy is more important than the number of findings.

The rule engine must specifically avoid false positives such as:

### Decorative images

```html
alt=""
```

should not automatically be treated as missing alt.

### Dynamic content

```liquid
alt="{{ product.title }}"
```

should not be treated as missing alt.

### Conditional markup

If a heading exists only under a valid conditional structure, the rule must not blindly count every possible source occurrence as simultaneous runtime output.

### Reusable sections

Do not treat a reusable section's H1 as a duplicate H1 without considering the template context.

### Translation strings

Do not flag:

- variables
- CSS
- URLs
- technical identifiers
- Liquid objects

as user-facing untranslated strings.

### Optional Shopify structures

Do not require files/structures that Shopify documentation does not actually require.

---

# 16. Rule testing

Every rule should have unit tests.

Test at least:

### Positive failure case

Theme code that should produce the finding.

### Positive pass case

Theme code that clearly satisfies the requirement.

### Edge case

A legitimate implementation that could be mistaken for a violation.

### Dynamic case

A Liquid implementation that should not produce a false positive.

For high-impact rules, include multiple real-theme fixtures.

---

# 17. Real-theme validation

Before considering the rule engine complete:

Run it against multiple real Shopify themes.

For each theme:

1. Run the complete rule set.
2. Review findings manually.
3. Verify at least 10 representative findings against actual source code.
4. Verify source references.
5. Investigate false positives.
6. Investigate important false negatives.
7. Record rules that require parser improvements.

The original project requires manual verification of findings and emphasizes avoiding false positives. fileciteturn0file0L58-L62

For this expanded scope, the validation set should be larger than the original v1 minimum.

---

# 18. Rule coverage

The engine must expose coverage information:

```text
Total Shopify requirements: 150

Implemented: 112
Partial: 18
Not implemented: 20

Coverage: 74.7%
```

A requirement is considered covered only when an executable rule is mapped to it.

This enables the `/rules` UI to show which Shopify requirements still need automation.

---

# 19. Rule performance

Rules should be fast.

Because this phase is deterministic:

- Avoid unnecessary repeated parsing.
- Reuse `ParsedFile[]`.
- Do not read the same file repeatedly from disk.
- Prefer indexed parser output.
- Avoid network requests during rule execution.

The target is for a normal theme audit to complete the static rule phase quickly enough that the user experiences it as a local code analysis rather than a slow remote service.

---

# 20. Finding deduplication

Multiple rules may identify the same underlying issue.

For example:

```text
Rule A:
Missing alt

Rule B:
Image accessibility failure
```

The engine should prevent duplicate user-facing findings when they refer to the same source location and issue.

A practical initial deduplication key can use:

```text
filePath
+
lineNumber
+
category
+
normalized finding
```

Keep the underlying rule IDs available for traceability.

---

# Acceptance criteria

Phase 3 is complete when:

- The rule engine can load enabled rules.
- Rules execute against `ParsedFile[]`.
- Shopify Theme Store requirements are mapped to executable rules.
- Findings are stored in MongoDB.
- Every Shopify compliance finding contains a rule/requirement reference.
- Accessibility checks work.
- Technical SEO checks work.
- Technical AEO/schema checks work.
- Localization checks work.
- Section/schema checks work.
- Theme structure/reference checks work.
- Deprecated Liquid checks work.
- Script/performance static checks work.
- Configuration checks work.
- Basic JavaScript integrity checks work.
- Internal standards can be executed separately from Shopify compliance.
- Severity is assigned consistently.
- Duplicate findings are controlled.
- Parser errors do not crash the entire audit.
- Unit tests cover pass/fail/edge cases for important rules.
- Multiple real Shopify themes have been audited and findings manually validated.
- False positives are actively reviewed and corrected.
- Rule coverage can be calculated.
- No AI API is required.
- No Voyage API is required.
- No embeddings or vector search are required.

# Explicitly out of scope

Do not build:

- Claude/OpenAI/other LLM integration
- Voyage
- Embeddings
- Vector database
- RAG
- AI-generated findings
- Content-quality SEO analysis
- Merchant-content analysis
- Real browser/Lighthouse execution
- Core Web Vitals measurement
- Google Sheets export
- Re-audit/diff
- Submission-readiness UI

Those belong to later phases.
