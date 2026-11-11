# Phase 8 — Testing, Security, Performance & Deployment

**Depends on:** Phases 0–7

**Goal:** Harden the complete Shopify Theme Store Auditor so it is reliable with real-world theme ZIPs, safe to run against untrusted source code, performant enough for practical use, and deployable without introducing unnecessary external dependencies.

This phase is the final engineering-hardening phase. It does not introduce new audit categories.

The application remains:

- MongoDB based
- Deterministic for the core audit
- Independent of AI APIs
- Independent of Voyage
- Independent of embeddings/vector search
- Independent of Google APIs for core functionality

## 1. End-to-end testing

Create a complete test pipeline covering:

```text
ZIP upload
 ↓
Theme validation
 ↓
Parsing
 ↓
Theme indexing
 ↓
Rule execution
 ↓
Cross-file analysis
 ↓
Finding persistence
 ↓
Readiness calculation
 ↓
Report generation
 ↓
Export
 ↓
Re-audit/diff
```

The objective is to verify that a theme can pass through the entire system without manual intervention.

## 2. Test levels

Use multiple test layers.

### Unit tests

Test:

- Parser utilities
- Individual rules
- Severity calculation
- Finding normalization
- Finding signatures
- Diff matching
- Readiness calculation
- Coverage calculation
- Export transformations

### Integration tests

Test:

- MongoDB persistence
- Audit execution
- Parser + rules
- Rule + requirement mapping
- Report generation
- Audit comparison

### End-to-end tests

Test:

- Upload a ZIP
- Run an audit
- View results
- Export results
- Upload a second version
- Compare audits
- Verify readiness

## 3. Test fixture library

Maintain a controlled collection of theme fixtures.

Recommended:

```text
tests/fixtures/
  valid-theme/
  invalid-zip/
  invalid-theme/
  schema-errors/
  localization-errors/
  accessibility-errors/
  seo-errors/
  aeo-errors/
  broken-references/
  javascript-errors/
  performance-patterns/
  dynamic-liquid/
  mixed-issues/
```

Each fixture should document:

```text
Expected findings
Expected severity
Expected rule IDs
Expected readiness
Expected diagnostics
```

Do not rely only on one "perfect" theme.

## 4. Golden audit fixtures

Create known expected outputs for representative themes.

Example:

```text
Fixture:
accessibility-errors

Expected:
A11Y-IMG-ALT-001
A11Y-FORM-LABEL-001
A11Y-LANG-001
```

The audit should fail the test if the expected finding disappears unexpectedly or a new unintended finding appears.

This protects against regression when parser/rule code changes.

## 5. Real Shopify theme validation

Regularly run the auditor against real themes.

For each validation cycle:

1. Upload theme.
2. Run full audit.
3. Review findings.
4. Verify source locations.
5. Verify Shopify source references.
6. Check false positives.
7. Check false negatives discovered manually.
8. Record parser limitations.
9. Add regression fixtures where appropriate.

The real-theme validation suite should grow over time.

## 6. Security: ZIP processing

Theme ZIP files are untrusted input.

Implement:

- Path traversal protection
- Safe extraction
- Temporary working directories
- Maximum ZIP size
- Maximum extracted size
- Maximum file count
- Maximum individual file size
- Archive bomb protection
- Malformed archive handling
- Automatic cleanup
- No execution of extracted code

Never execute:

- Liquid
- JavaScript
- Shell scripts
- PHP
- binaries
- theme build scripts

The application is a static analyzer.

## 7. Resource limits

Prevent one malicious or extremely large theme from consuming unlimited resources.

Configure limits for:

```text
Maximum ZIP size
Maximum extracted size
Maximum number of files
Maximum file size
Maximum audit duration
Maximum parser memory
```

If a limit is exceeded:

```text
Audit failed safely
```

with a clear diagnostic.

Do not leave partial temporary files behind.

## 8. MongoDB security

For production deployment:

- Use authenticated MongoDB access.
- Do not expose MongoDB publicly.
- Store credentials in environment variables.
- Use least-privilege database credentials.
- Restrict network access.
- Enable encrypted connections where required.
- Back up audit history.
- Add indexes for common queries.

Recommended indexes:

```text
audit_runs.themeId
audit_runs.startedAt
findings.auditRunId
findings.ruleId
findings.category
findings.severity
requirements.requirementId
rules.ruleId
```

## 9. Input validation

Validate all API inputs.

Examples:

- Audit IDs
- Theme IDs
- Rule IDs
- Requirement IDs
- Finding status
- Severity
- Category
- Export format
- Comparison audit IDs

Never trust client-provided values.

## 10. API authorization boundary

The initial product may be single-user/internal, but keep the API architecture ready for authentication later.

Do not expose administrative endpoints such as:

```text
rule creation
requirement modification
maintenance actions
```

without a clear authorization boundary in a production environment.

Authentication itself can remain out of the initial scope if the application is strictly local/internal.

## 11. File privacy

Theme ZIPs may contain proprietary commercial code.

The application should:

- Process files locally when possible.
- Avoid sending theme source code to external APIs.
- Avoid AI/API dependencies in the core system.
- Delete temporary extraction data after the audit unless explicitly retained.
- Clearly define what audit data is persisted.
- Allow administrators to configure retention.

This is a major benefit of the current architecture.

## 12. Audit data retention

Define retention behavior for:

- Audit metadata
- Findings
- Requirement snapshots
- Rule versions
- Diagnostics
- Optional source snapshots

Suggested default:

```text
Audit metadata:
Persistent

Findings:
Persistent

Requirement/rule versions:
Persistent

Extracted ZIP:
Temporary unless explicitly retained

Full parsed source:
Not persisted by default
```

This minimizes storage of proprietary theme code.

## 13. Error handling

All layers must fail gracefully.

### Parser error

Continue where possible.

### Rule error

Record the failed rule and continue the audit.

### Database error

Fail the audit safely and preserve an actionable error.

### Export error

Do not alter the completed audit.

### Diff error

Do not alter either audit.

The user should never lose a completed audit because an export failed.

## 14. Audit observability

Track execution timing:

```text
ZIP extraction
Theme validation
Parsing
Theme index
Cross-file analysis
Rule execution
Finding persistence
Report generation
Export
Diff
```

Store useful diagnostics.

Example:

```text
Audit duration: 8.4s

Parsing: 2.1s
Indexing: 0.8s
Rules: 4.3s
Persistence: 0.7s
Report: 0.5s
```

This will help identify performance regressions.

## 15. Performance optimization

The system should:

- Parse files once.
- Build the theme index once.
- Build dependency graphs once.
- Reuse parsed structures across rules.
- Avoid repeated filesystem reads.
- Avoid unnecessary MongoDB queries.
- Batch finding writes where appropriate.
- Avoid network requests during the core audit.
- Run independent rule groups efficiently.

Do not optimize prematurely at the cost of audit accuracy.

## 16. Audit execution strategy

For a normal theme:

```text
Upload
 ↓
Parse
 ↓
Index
 ↓
Rules
 ↓
Persist
```

For larger themes, consider controlled parallel execution of independent rule groups.

Do not parallelize operations that mutate shared state unless the implementation guarantees safe behavior.

## 17. MongoDB indexes and query performance

Add indexes based on actual query patterns.

Minimum expected indexes:

```text
themes._id

audit_runs.themeId
audit_runs.status
audit_runs.startedAt

findings.auditRunId
findings.ruleId
findings.category
findings.severity
findings.status

requirements.requirementId
requirements.sourceType
requirements.status

rules.ruleId
rules.category
rules.enabled
```

Use compound indexes where audit/report queries demonstrate a need.

Do not add large numbers of indexes without measuring their benefit.

## 18. Frontend performance

The dashboard should remain responsive for audits containing hundreds or thousands of findings.

Use:

- Pagination or virtualization for large finding lists
- Server-side filtering where appropriate
- Lazy loading for detailed source views
- Efficient MongoDB queries
- Avoid rendering every finding at once

The summary dashboard should load faster than the complete findings list.

## 19. Export performance

Exports should be generated from the normalized `AuditReport`.

Do not rerun the audit to generate an export.

The flow must be:

```text
Stored Audit
 ↓
AuditReport
 ↓
Exporter
```

not:

```text
Stored Audit
 ↓
Run audit again
 ↓
Export
```

## 20. Deployment architecture

The application should support:

### Local development

```text
Next.js
+
Docker MongoDB
```

### Production

```text
Next.js application
        ↓
MongoDB
```

The exact hosting provider is intentionally not fixed in this phase.

The architecture should work with common Node/Next.js hosting environments and a reachable MongoDB deployment.

## 21. Environment configuration

Use environment variables for:

```text
MONGODB_URI
MONGODB_DATABASE
```

If authentication is added later:

```text
AUTH_SECRET
```

Do not commit credentials.

Provide:

```text
.env.example
```

with placeholders only.

## 22. Docker support

Provide Docker configuration for local development where useful.

Suggested:

```text
docker-compose.yml

services:
  mongodb:
    image: ...
```

The exact MongoDB version must be pinned rather than using an uncontrolled `latest` tag.

The application should document how to:

```text
Start MongoDB
Stop MongoDB
Reset local database
Seed requirements
Run application
```

## 23. Database migration/seed strategy

Provide scripts for:

```text
npm run db:seed
npm run db:indexes
```

If schema changes require migrations, create versioned migration scripts.

Requirement seeding must remain idempotent.

## 24. Production logging

Use structured logs for:

- Audit start
- Audit completion
- Audit failure
- Parser warnings
- Rule failures
- Export failures
- Diff failures
- Database failures

Never log full theme source code.

Avoid logging:

- Uploaded ZIP contents
- Secrets
- Credentials
- Full proprietary Liquid files

## 25. Health checks

Provide:

```text
GET /api/health
```

Return status for:

```text
Application
MongoDB
Rule registry
Requirement registry
```

Example:

```json
{
  "status": "healthy",
  "database": "healthy",
  "rules": "healthy",
  "requirements": "healthy"
}
```

## 26. Backup and recovery

Production audit history should be recoverable.

Back up:

- Themes metadata
- Audit runs
- Findings
- Requirements
- Rules
- Rule versions
- Requirement versions

Do not necessarily back up extracted theme ZIPs unless the product explicitly retains them.

Test restoration periodically.

## 27. Release checklist

Before deploying a new version:

```text
□ Unit tests pass
□ Integration tests pass
□ End-to-end tests pass
□ Regression fixtures pass
□ Real-theme validation completed
□ No critical parser regressions
□ No critical rule regressions
□ Requirement coverage checked
□ Database migration reviewed
□ Seed process tested
□ Security checks completed
□ ZIP limits verified
□ Production environment variables verified
```

## 28. Audit engine release versioning

Version:

```text
Application
Parser
Rule engine
Rules
Requirements
```

Example:

```text
Application: 1.0.0
Parser:      1.0.0
Rule engine: 1.0.0
Rule set:    1.4.0
Requirements: 1.2.0
```

Store these versions on every audit.

This makes historical results reproducible.

## 29. Final product acceptance test

Run a complete real-world scenario:

### Step 1

Start MongoDB.

### Step 2

Start the application.

### Step 3

Upload a real Shopify theme ZIP.

### Step 4

Run the complete audit.

### Step 5

Verify:

- Theme parsing
- Shopify compliance rules
- Accessibility
- Technical SEO
- Technical AEO
- Bug checks
- Internal standards
- Findings
- Source references
- Coverage
- Readiness

### Step 6

Export:

- CSV
- XLSX
- JSON
- HTML/PDF if implemented

### Step 7

Fix several findings in the theme.

### Step 8

Upload the new theme version.

### Step 9

Run the re-audit.

### Step 10

Verify:

- Resolved findings
- Persistent findings
- New findings
- Changed findings
- Readiness changes
- Historical audit preservation

### Step 11

Restart the application and verify audit history remains available.

## 30. Final acceptance criteria

The complete application is considered production-ready when:

- A real Shopify theme ZIP can be uploaded safely.
- Malicious/invalid ZIPs cannot escape the extraction directory.
- Large/unsafe archives are limited.
- Theme parsing is reliable.
- Static rules execute reliably.
- Cross-file analysis works.
- Findings are persisted.
- Reports are generated.
- Exports work.
- Re-audits work.
- Finding diffs work.
- Submission readiness works.
- Requirement coverage works.
- Historical audits remain reproducible.
- Rule/requirement versions are retained.
- MongoDB data is indexed appropriately.
- Errors are handled gracefully.
- Temporary theme source is cleaned up according to retention policy.
- No proprietary theme code is sent to an external AI service.
- No AI API is required.
- No Voyage API is required.
- No embeddings/vector search is required.
- The application can run with the core stack locally using Docker MongoDB.

## Explicitly out of scope

Do not add:

- AI/LLM services
- Voyage
- Vector databases
- RAG
- Automatic Shopify documentation crawling
- Automatic Shopify Theme Store submission
- Shopify approval prediction
- Merchant-content SEO analysis
- Browser-based runtime auditing
- Real Core Web Vitals measurement
- External analytics that require sending theme source outside the application
