# Phase 1 — Shopify Requirements & Standards Knowledge Base

**Depends on:** Phase 0 (MongoDB schema + application shell)

**Goal:** Build the structured knowledge base that defines what the auditor must check. This phase replaces the original embedding/vector-search approach. The core application does not require Voyage, embeddings, pgvector, or any AI API.

The purpose of this phase is to turn Shopify's official Theme Store documentation and the project's internal standards into traceable requirements that can later be mapped to executable audit rules.

## Scope

### 1. Primary source: Shopify Theme Store requirements

Shopify's official documentation is the authoritative source for compliance checks.

The knowledge base should cover, as applicable:

- Shopify Theme Store requirements
- Theme Store review process
- Common theme rejection reasons
- Shopify theme technical requirements
- Shopify Liquid/development documentation relevant to themes
- Shopify deprecation documentation
- Localization requirements
- Accessibility requirements
- Performance-related technical requirements
- Theme architecture requirements
- Other official Shopify documentation that defines or clarifies Theme Store expectations

Do not treat generic SEO, AEO, design, or coding advice as Shopify compliance requirements unless an official Shopify source supports that classification.

### 2. Internal theme standards

The system must also support rules that are specific to the team's own development standards.

Examples may include:

- Preferred theme architecture
- Approved section patterns
- Accessibility conventions
- UX conventions
- Performance conventions
- Coding conventions
- Approved component patterns
- Internal Theme Store preparation standards

These must be clearly separated from Shopify requirements.

### 3. Technical best practices

The knowledge base may contain additional best-practice requirements for:

- Technical SEO
- Technical AEO / structured data
- Accessibility
- Performance
- Code quality

These are recommendations unless they are explicitly supported by a Shopify requirement.

They must never be presented as Shopify rejection criteria without an authoritative Shopify source.

## Requirement hierarchy

Every requirement must have a source classification.

Recommended source types:

```ts
type RequirementSourceType =
  | 'shopify_theme_store'
  | 'internal_standard'
  | 'technical_seo'
  | 'technical_aeo'
  | 'accessibility'
  | 'best_practice';
```

The hierarchy is:

```text
Shopify Official Requirement
        ↓
Theme Store Compliance Rule

Internal Standard
        ↓
Internal Standard Rule

Technical Best Practice
        ↓
Best-Practice Rule
```

This distinction is critical. The application must be able to tell the user whether an issue is:

> A Shopify Theme Store compliance failure

or:

> An internal/best-practice recommendation.

## Requirement data model

Store requirements in the MongoDB `requirements` collection.

Suggested structure:

```ts
type Requirement = {
  _id: ObjectId;

  requirementId: string;

  sourceType:
    | 'shopify_theme_store'
    | 'internal_standard'
    | 'technical_seo'
    | 'technical_aeo'
    | 'accessibility'
    | 'best_practice';

  category:
    | 'Theme Store Compliance'
    | 'Accessibility'
    | 'Technical SEO'
    | 'Technical AEO'
    | 'Bug'
    | 'Internal Standard';

  title: string;

  description: string;

  requirementText?: string;

  sourceName?: string;

  sourceReference?: string;

  sourceUrl?: string;

  severity:
    | 'blocker'
    | 'high'
    | 'medium'
    | 'low';

  status:
    | 'active'
    | 'deprecated'
    | 'draft';

  ruleStatus:
    | 'not_implemented'
    | 'partial'
    | 'implemented';

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

## Requirement IDs

Every requirement must have a stable unique ID.

Examples:

```text
SHOPIFY-STRUCTURE-001
SHOPIFY-LIQUID-001
SHOPIFY-LOCALIZATION-001
SHOPIFY-A11Y-001

TECH-SEO-H1-001
TECH-SEO-CANONICAL-001

TECH-AEO-PRODUCT-001

INTERNAL-UX-001
INTERNAL-A11Y-001
```

Do not use database-generated IDs as the primary identifier for rules. Stable requirement IDs are needed for rule coverage, auditing, maintenance, and future Shopify documentation updates.

## Requirement-to-rule mapping

A central purpose of this phase is to establish the mapping:

```text
Requirement
     ↓
Executable Rule
```

For example:

```text
Requirement:
SHOPIFY-A11Y-001

Description:
Images must have appropriate alternative text.

Rule:
A11Y-IMG-ALT-001

Implementation:
Inspect parsed image elements and identify missing alt attributes.

Result:
Finding
```

Not every requirement must immediately have a rule. Some requirements may require later implementation.

The database must therefore track:

```text
not_implemented
partial
implemented
```

This allows the application to eventually report rule coverage.

## Shopify requirement checklist

Before Phase 3 begins, the Shopify documentation should be reviewed and converted into a structured checklist of distinct requirements.

For each requirement record, capture:

1. Requirement ID
2. Category
3. Requirement title
4. Requirement description
5. Source document
6. Source section/reference
7. Source URL when available
8. Compliance severity
9. Whether it can be checked automatically
10. Planned rule ID, if applicable
11. Implementation status
12. Notes/limitations

### Important

Do not create a rule merely because a document contains a general recommendation.

A requirement should become a Theme Store Compliance rule only when the source establishes it as a Shopify requirement or a necessary technical condition.

## Audit scope definitions

The knowledge base should reflect the application's actual audit scope.

### Shopify Theme Store Compliance

This is the primary audit category.

It should cover code, architecture, implementation, configuration, localization, accessibility, performance-related technical requirements, and other requirements that can be evaluated from the theme package.

### Technical SEO

Only structural/code-level SEO is in scope.

Examples:

- Missing H1
- Multiple H1s
- Incorrect heading hierarchy
- Missing canonical structure
- Missing meta description structure where applicable
- Missing image alt attributes
- Missing image dimensions
- Missing lazy-loading attributes where applicable
- Other technically verifiable theme-level SEO structures

Do not evaluate actual merchant content quality.

Do not evaluate:

- Product title quality
- Product description quality
- Keyword quality
- Marketing copy
- Actual search rankings
- Content depth
- Merchant-specific SEO performance

### Technical AEO / Structured Data

Only theme-level implementation is in scope.

Examples:

- Product JSON-LD presence
- Organization schema presence
- Article schema presence
- JSON-LD validity
- Required structural fields
- Dynamic Shopify data references
- Placeholder schema values

Do not evaluate actual merchant content quality or real-world search performance.

### Accessibility

Focus on structural and implementation-level accessibility.

Examples:

- Missing alt attributes
- Missing labels
- Missing `lang`
- Accessible semantics
- ARIA implementation where deterministically verifiable
- Keyboard/focus implementation patterns where deterministically verifiable
- Contrast where reliably calculable

### Bugs

Focus on technically verifiable implementation problems and obvious code-level defects.

### Internal Standards

Evaluate the theme against standards defined by the team.

## No vector search in Phase 1

The original implementation used:

```text
source chunks
→ embeddings
→ pgvector
→ semantic retrieval
```

That is removed from the current scope.

Do not implement:

- Embedding generation
- Voyage API
- OpenAI embeddings
- pgvector
- Vector indexes
- Semantic retrieval
- RAG infrastructure

The requirement database and rule metadata are sufficient for the core deterministic audit system.

## Optional source management

The application may later provide a UI for adding/updating source documentation, but the primary purpose is structured requirement management rather than generic document search.

A future source-management record can contain:

```ts
type RequirementSource = {
  _id: ObjectId;
  name: string;
  sourceType: 'shopify' | 'internal' | 'best_practice';
  url?: string;
  version?: string;
  lastReviewedAt?: Date;
  active: boolean;
  notes?: string;
};
```

This is optional for Phase 1 if the initial requirements are seeded directly into MongoDB.

## Seeding the initial requirements

Create a seed process so the application can populate the initial requirement records consistently.

The seed process should be:

- Repeatable
- Idempotent
- Version controlled
- Safe to run against a fresh database
- Able to update existing requirements without creating duplicates

Example:

```text
npm run seed:requirements
```

The seed should create the initial Shopify requirements and internal standards.

Do not hardcode requirements only inside executable rule functions. Requirements need to remain independently inspectable so the application can later show coverage and source traceability.

## Requirement management UI

The `/rules` page or a dedicated requirement section should eventually allow users to:

- View requirements
- Filter by source type
- Filter by category
- Filter by implementation status
- View source references
- View associated rules
- Enable/disable applicable internal standards
- Identify requirements without automated rules

A full rule editor is not required to complete Phase 1.

## Acceptance criteria

- The `requirements` collection exists in MongoDB.
- Requirement documents can be created, read, updated, and queried.
- Stable requirement IDs are enforced.
- Requirements can be categorized as Shopify compliance, internal standard, technical SEO, technical AEO, accessibility, or best practice.
- Every Shopify compliance requirement has a source reference or source URL when the source provides one.
- Every requirement has a rule implementation status.
- Initial Shopify Theme Store requirements are seeded into MongoDB.
- Initial internal standards can be seeded separately from Shopify requirements.
- The application can identify requirements that do not yet have an executable rule.
- No embeddings or external AI APIs are required.
- No generic SEO/content-quality rules are introduced.
- The database clearly distinguishes Shopify compliance requirements from best-practice recommendations.

## Phase 1 deliverable

At the end of this phase, the application should have a reliable structured definition of:

```text
WHAT must be checked
        +
WHY it must be checked
        +
WHERE the requirement came from
        +
WHETHER an automated rule exists
```

Phase 2 will use the requirement definitions to determine what information the Shopify theme parser needs to extract.

## Explicitly out of scope

Do not build:

- Theme ZIP parsing
- Static rule execution
- AI/LLM review
- Embeddings
- Vector search
- Voyage
- RAG
- Google Sheets
- Audit diffing
- Submission-readiness calculation
- Merchant-content SEO analysis
- Generic content-quality scoring
