# Phase 0 — Foundation & MongoDB Scaffolding

**Depends on:** Nothing (starting point)

**Goal:** Create the application foundation for a Shopify Theme Store Pre-Submission Auditor using Next.js, TypeScript, and the existing local MongoDB setup running through Docker. This phase establishes the database models, application shell, audit lifecycle, and API structure. No theme parsing, rule evaluation, AI, embeddings, or Google Sheets integration is built in this phase.

## Scope

### Application stack

- Next.js with App Router
- TypeScript
- Node.js server/API routes
- MongoDB as the primary database
- Local MongoDB running through Docker
- MongoDB driver or Mongoose; choose one and use it consistently
- No authentication — this remains a single-user internal tool unless that requirement changes later

### Main application views

Create the initial page shells:

- `/audit` — upload and run a theme audit
- `/rules` — browse and manage audit rules
- `/reports` — view completed audit runs and findings
- `/settings` — basic application/rule configuration

Navigation between these pages should work from the beginning.

## Database model

Use MongoDB collections rather than the original PostgreSQL/pgvector schema.

### `themes`

Stores each theme that has been audited.

```ts
type Theme = {
  _id: ObjectId;
  name: string;
  sourceFileName?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

A theme can have multiple audit runs over time.

### `audit_runs`

Stores each individual audit execution.

```ts
type AuditRun = {
  _id: ObjectId;
  themeId: ObjectId;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  summary?: {
    total: number;
    blocker: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<string, number>;
  };
};
```

### `findings`

Stores every issue discovered during an audit.

```ts
type Finding = {
  _id: ObjectId;
  auditRunId: ObjectId;
  ruleId: string;
  filePath: string;
  lineNumber?: number;
  category:
    | 'Theme Store Compliance'
    | 'Accessibility'
    | 'Technical SEO'
    | 'Technical AEO'
    | 'Bug'
    | 'Internal Standard';
  severity: 'blocker' | 'high' | 'medium' | 'low';
  layer: 'static';
  finding: string;
  recommendation?: string;
  sourceReference?: string;
  sourceUrl?: string;
  createdAt: Date;
};
```

The `layer` field is intentionally `static` only for the initial version. If AI-assisted review is added later, an `llm` layer can be introduced without changing the core finding model.

### `requirements`

Stores the authoritative requirements and standards that rules are based on.

```ts
type Requirement = {
  _id: ObjectId;
  requirementId: string;
  sourceType:
    | 'shopify_theme_store'
    | 'accessibility'
    | 'technical_seo'
    | 'technical_aeo'
    | 'internal_standard'
    | 'best_practice';
  title: string;
  description: string;
  sourceReference?: string;
  sourceUrl?: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  status: 'active' | 'deprecated' | 'draft';
  createdAt: Date;
  updatedAt: Date;
};
```

The most important source type is `shopify_theme_store`. Shopify requirements are authoritative compliance requirements. General best practices must remain distinguishable from requirements that can cause a Theme Store rejection.

### `rules`

Stores the executable audit rule metadata.

```ts
type Rule = {
  _id: ObjectId;
  ruleId: string;
  requirementId?: string;
  category:
    | 'Theme Store Compliance'
    | 'Accessibility'
    | 'Technical SEO'
    | 'Technical AEO'
    | 'Bug'
    | 'Internal Standard';
  defaultSeverity: 'blocker' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sourceReference?: string;
  sourceUrl?: string;
  enabled: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
```

The executable implementation for each rule will live in the application codebase. MongoDB stores the rule metadata, source mapping, status, and configuration.

### `audit_settings`

Stores application-level settings that may be required later, such as enabled rule groups or submission-readiness configuration.

Keep this collection minimal in Phase 0.

## Rule and requirement relationship

The core architecture is:

```text
Shopify documentation
        ↓
Requirement
        ↓
Rule
        ↓
Parsed theme data
        ↓
Finding
```

Every Shopify compliance rule must be traceable to an actual Shopify requirement or documented technical source.

Do not build a generic AI knowledge base or vector/embedding infrastructure in this phase.

## Audit lifecycle

Establish the API/service structure for:

```text
POST /api/audit/run
GET  /api/audit/[id]
GET  /api/audit/[id]/findings

GET  /api/rules
GET  /api/requirements

GET  /api/reports
GET  /api/reports/[id]
```

The actual audit implementation can initially return a controlled placeholder until later phases are implemented.

## Folder structure

Establish a structure similar to:

```text
/app
  /audit/page.tsx
  /rules/page.tsx
  /reports/page.tsx
  /settings/page.tsx

  /api
    /audit/run/route.ts
    /audit/[id]/route.ts
    /audit/[id]/findings/route.ts
    /rules/route.ts
    /requirements/route.ts
    /reports/route.ts
    /reports/[id]/route.ts

/lib
  /db/
  /theme-parser/
  /rules/
    /shopify/
    /accessibility/
    /technical-seo/
    /technical-aeo/
    /bugs/
    /internal/
  /audit/
  /reports/

/models
  theme.ts
  audit-run.ts
  finding.ts
  requirement.ts
  rule.ts
  audit-settings.ts
```

The rule folders should remain empty until their respective phases.

## Important architectural decisions

### No PostgreSQL

The application will use MongoDB instead of the original PostgreSQL schema.

### No pgvector

Vector search is not required for the core application.

### No Voyage API

Embeddings are not required for the core application.

### No AI API

The initial auditor must work without Claude, OpenAI, Voyage, or any other external AI API.

AI may be considered later as an optional enhancement for judgment-based review, but it must not be a dependency of the core audit pipeline.

### No Google Sheets dependency

Google Sheets will be an optional reporting integration in a later phase. The core application must be able to generate and display audit results without Google APIs.

## Acceptance criteria

- `npm run dev` boots the application successfully.
- The application connects to the local MongoDB instance running through Docker.
- MongoDB collections/models can be created and queried successfully.
- `/audit`, `/rules`, `/reports`, and `/settings` are navigable.
- A test theme can be created.
- A test audit run can be created and stored.
- A test finding can be stored and retrieved.
- Requirements and rules can be stored and retrieved.
- The API routes return structured responses rather than placeholder 501 errors where basic CRUD is expected.
- No PostgreSQL, pgvector, Voyage, embedding, Claude, OpenAI, or Google Sheets dependency is introduced in this phase.

## Explicitly out of scope

Do not build:

- Shopify theme parsing
- ZIP extraction logic beyond preparing the upload/API boundary
- Static audit rules
- SEO audit logic
- Accessibility audit logic
- AEO/schema audit logic
- Bug detection
- Internal theme-standard checks
- AI/LLM review
- Embeddings
- Vector search
- Google Sheets export
- Re-audit/diff logic
- Submission-readiness calculation

Those belong to later phases.
