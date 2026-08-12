# Phase 7 — Submission Readiness, Rule Coverage & Maintenance

**Depends on:** Phases 0–6

**Goal:** Bring the complete audit system together into a trustworthy Shopify Theme Store pre-submission workflow. This phase does not introduce a new audit engine. It combines current findings, Shopify requirement coverage, rule status, audit diagnostics, and historical results into a clear submission-readiness assessment and establishes the maintenance workflow required to keep the auditor accurate as Shopify requirements and the application's rules evolve.

The application remains fully functional without AI, Voyage, embeddings, vector search, or external inference APIs.

## 1. Submission-readiness model

The final status must distinguish between:

```text
READY
NOT_READY
INCOMPLETE
```

### READY

The theme can be considered ready by the application's configured audit criteria when:

- All mandatory/blocker compliance conditions pass.
- No open blocker findings remain in required categories.
- Required analysis completed successfully.
- Required Shopify requirements have sufficient automated coverage according to the configured readiness threshold.
- No critical audit diagnostics invalidate the result.

The application must clearly state that this means:

> Ready according to the application's implemented and configured audit rules.

It must never claim:

> Shopify approved this theme.

Only Shopify can make the final Theme Store approval decision.

### NOT_READY

Use when:

- One or more submission-blocking findings remain.
- A required Shopify compliance rule fails.
- A mandatory readiness condition is not satisfied.

### INCOMPLETE

Use when:

- Important Shopify requirements have no automated rule.
- Critical parser failures prevent meaningful analysis.
- Required analysis was skipped.
- Rule coverage is below the configured minimum for a readiness claim.

An incomplete audit must not be presented as a clean audit.

## 2. Readiness configuration

Create configurable readiness criteria.

Suggested structure:

```ts
type ReadinessConfig = {
  minimumShopifyCoverage: number;

  blockerCategories: FindingCategory[];

  blockerSeverities: ('blocker' | 'high')[];

  requireNoParserCriticalErrors: boolean;

  requireNoSkippedMandatoryRules: boolean;

  requireMinimumCoverage: boolean;
};
```

Do not hardcode all readiness logic directly inside the UI.

The readiness engine should evaluate a structured configuration.

## 3. Readiness evaluation

Create a dedicated service:

```text
evaluateSubmissionReadiness(auditReport, readinessConfig)
```

Return:

```ts
type ReadinessResult = {
  status: 'READY' | 'NOT_READY' | 'INCOMPLETE';

  reasons: ReadinessReason[];

  blockers: Finding[];

  coverage: {
    percentage: number;
    total: number;
    implemented: number;
    partial: number;
    notImplemented: number;
  };

  diagnostics: AuditDiagnostic[];
};
```

## 4. Readiness reasons

Every non-ready/incomplete result must explain why.

Example:

```text
NOT READY

Reasons:

3 blocker findings remain.

1 Shopify Theme Store requirement failed.

2 mandatory accessibility checks failed.
```

For incomplete:

```text
INCOMPLETE

Reasons:

20 Shopify requirements have no automated rule.

3 required files could not be analyzed.

1 mandatory rule was skipped.
```

Do not show only a red status without an explanation.

## 5. Blocker management

The system must distinguish:

```text
Blocker finding
```

from:

```text
High severity finding
```

and:

```text
Best-practice recommendation
```

Only configured blocking conditions should prevent READY.

Do not automatically treat every `high` finding as a submission blocker unless the readiness configuration says so.

## 6. Requirement coverage dashboard

Create a detailed Shopify requirement coverage view.

Example:

```text
Shopify Theme Store Requirements

Total requirements: 150

Implemented rules:    112
Partial coverage:      18
Not implemented:       20

Coverage: 74.7%
```

Break down by category:

```text
Theme Structure      92%
Liquid               88%
Localization         76%
Accessibility        81%
Schema               94%
Performance          68%
```

Only count active requirements in the coverage calculation unless the user explicitly requests historical/deprecated requirements.

## 7. Requirement coverage states

Use:

```ts
type RuleCoverageStatus =
  | 'implemented'
  | 'partial'
  | 'not_implemented'
  | 'not_applicable';
```

### Implemented

A rule exists and can evaluate the requirement.

### Partial

A rule exists but can only verify part of the requirement.

### Not implemented

No automated rule exists.

### Not applicable

The requirement does not apply to the current theme/context.

Do not count `not_applicable` as a missing implementation.

## 8. Coverage confidence

Coverage percentage should not imply that the implemented rules are perfect.

Show:

```text
Automated coverage: 82%

This represents requirements with automated checks,
not Shopify approval or guaranteed compliance.
```

This wording is important for product accuracy.

## 9. Requirements without rules

Provide a dedicated list:

```text
Requirements without automated coverage

SHOPIFY-XYZ-001
SHOPIFY-XYZ-002
SHOPIFY-XYZ-003
```

For each item show:

- Requirement ID
- Title
- Category
- Source
- Severity
- Reason no rule exists
- Implementation status

This becomes the backlog for future rule development.

## 10. Partial rules

Show partial rules separately.

Example:

```text
Partial coverage

SHOPIFY-PERF-003

Currently checks:
✓ Script defer/async structure

Does not check:
✗ Runtime loading behavior
✗ Browser performance
```

This prevents the application from misleading users about what a rule actually verifies.

## 11. Rule inventory

Create a complete rule inventory.

Example:

```text
Rule ID
Title
Category
Requirement
Severity
Status
Version
Last reviewed
```

Filters:

- Category
- Status
- Severity
- Shopify/Internal
- Implemented/Partial/Missing

## 12. Rule versioning

Rules must be versioned.

Suggested:

```ts
type RuleVersion = {
  ruleId: string;
  version: number;
  implementationVersion: string;
  changedAt: Date;
  changeReason?: string;
  notes?: string;
};
```

When a rule changes materially, increment its version.

Examples:

```text
A11Y-IMG-ALT-001 v1
A11Y-IMG-ALT-001 v2
```

Historical audits must retain the version used at the time.

## 13. Requirement versioning

Shopify documentation can change.

Store enough metadata to identify the requirement version/source used by an audit.

Suggested:

```ts
type RequirementVersion = {
  requirementId: string;
  version: number;
  sourceUrl?: string;
  sourceReference?: string;
  sourceText?: string;
  reviewedAt: Date;
  changeNotes?: string;
};
```

When the underlying Shopify requirement changes significantly, create a new version rather than rewriting history.

## 14. Requirement review workflow

Create a maintenance workflow:

```text
Shopify documentation update
        ↓
Review requirement
        ↓
Update requirement/version
        ↓
Identify affected rules
        ↓
Update rule implementation
        ↓
Run regression tests
        ↓
Update coverage
```

The application does not need automatic web crawling in this phase.

Manual review/curation is acceptable for the initial version.

## 15. Rule review metadata

For each rule, support:

```text
Last reviewed
Reviewed by
Source last checked
Implementation version
Test status
Notes
```

This is especially useful for Shopify requirements that can change over time.

## 16. Rule test coverage

Track whether every active rule has automated tests.

Example:

```text
Rules: 128

With tests:       119
Without tests:      9

Test coverage: 93%
```

For critical Shopify compliance rules, require tests before the rule can be marked production-ready.

## 17. Critical rule classification

Mark rules as critical when failure could materially affect Theme Store submission.

Example:

```ts
type RuleCriticality =
  | 'critical'
  | 'important'
  | 'informational';
```

Critical rules should have:

- Requirement source
- Unit tests
- Real-theme validation
- Defined severity
- Known limitations
- Review date

## 18. Real-theme regression suite

Maintain a collection of representative Shopify theme fixtures.

Suggested fixture groups:

```text
fixtures/
  valid-theme/
  schema-errors/
  accessibility-errors/
  localization-errors/
  seo-errors/
  structured-data-errors/
  broken-references/
  performance-patterns/
  dynamic-liquid/
```

Run the full rule suite against these fixtures whenever:

- Parser changes
- Rule changes
- Requirement changes
- Readiness logic changes

## 19. Real-world theme validation

The application should periodically be tested against real Shopify themes.

For each validation cycle:

1. Run the complete audit.
2. Review Shopify compliance findings.
3. Review accessibility findings.
4. Review SEO/AEO findings.
5. Compare against expected behavior.
6. Record false positives.
7. Record false negatives.
8. Update parser/rules where necessary.
9. Re-run the regression suite.

This is a quality process, not an automated Shopify approval mechanism.

## 20. Audit quality metrics

Track internal metrics such as:

```text
Rule coverage
Rule test coverage
Findings per theme
False-positive rate
False-negative discoveries
Parser warnings
Unresolved dynamic references
Rules skipped
Average audit duration
```

These metrics should primarily support development and maintenance.

Do not present an internal quality metric as a Shopify compliance score unless clearly labeled.

## 21. Compliance score

If a single score is displayed, it must be carefully defined.

A safer model is to show separate scores/statuses:

```text
Shopify Compliance
Accessibility
Technical SEO
Technical AEO
Internal Standards
```

Avoid a misleading:

```text
Shopify Score: 97/100
```

unless the scoring methodology is explicitly defined and the UI explains that it is an application-generated assessment.

The primary result should remain:

```text
READY
NOT READY
INCOMPLETE
```

with the reasons.

## 22. Final submission-readiness dashboard

The final dashboard should show:

```text
SHOPIFY THEME STORE READINESS

        NOT READY

3 Blockers
12 High
18 Medium
9 Low

Shopify Compliance
    18 findings

Accessibility
     7 findings

Technical SEO
     5 findings

Technical AEO
     4 findings

Rule Coverage
    94.2%

Critical diagnostics
     0

[View Blockers]
[View All Findings]
[View Coverage]
[View Audit History]
```

If ready:

```text
SHOPIFY THEME STORE READINESS

        READY

0 Blockers
0 Mandatory Failures

Rule Coverage
98.6%

Critical diagnostics
0

[View Audit]
[Export Report]
```

If incomplete:

```text
SHOPIFY THEME STORE READINESS

      INCOMPLETE

20 Shopify requirements have no automated rule.

The application cannot make a complete readiness assessment.

[View Missing Coverage]
```

## 23. Maintenance dashboard

Create a developer/admin-facing maintenance view showing:

```text
Requirements
150

Active rules
128

Unimplemented requirements
20

Partial rules
18

Rules without tests
9

Rules needing review
6

Deprecated requirements
4
```

This becomes the control center for maintaining the auditor.

## 24. Requirement-to-rule traceability matrix

Provide a matrix:

| Requirement | Rule | Status | Tests | Source |
|---|---|---|---|---|
| SHOPIFY-A11Y-001 | A11Y-IMG-ALT-001 | Implemented | Yes | Shopify |
| SHOPIFY-LOC-002 | LOC-KEY-001 | Partial | Yes | Shopify |
| SHOPIFY-PERF-003 | PERF-SCRIPT-001 | Not implemented | No | Shopify |

This is one of the most important maintenance tools in the application.

It makes gaps visible immediately.

## 25. Shopify update impact analysis

When a requirement changes:

```text
Requirement updated
        ↓
Affected rules
        ↓
Affected tests
        ↓
Affected audit categories
```

Display:

```text
SHOPIFY-A11Y-001 updated

Affected rules:
- A11Y-IMG-ALT-001
- A11Y-IMG-ICON-002

Affected tests:
- accessibility-images
- accessibility-icons
```

This helps prevent documentation changes from silently making the auditor inaccurate.

## 26. Safe rule deployment

Before enabling a new or changed critical rule:

1. Validate requirement source.
2. Implement rule.
3. Add unit tests.
4. Run real-theme fixtures.
5. Review false positives.
6. Review false negatives.
7. Mark rule as tested.
8. Enable rule.

Do not deploy experimental rules as blockers without validation.

## 27. Audit engine health

The application should expose an internal health summary:

```text
Audit Engine Health

Parser
✓ Healthy

Rule Engine
✓ Healthy

Shopify Requirement Coverage
⚠ 20 requirements missing

Critical Rules
✓ All tested

Regression Suite
✓ Passing

External APIs
Not required
```

The system is deliberately designed so the core audit engine can operate without third-party AI services.

## 28. Final end-to-end workflow

The completed product workflow should be:

```text
1. Upload Shopify Theme ZIP
          ↓
2. Validate ZIP/theme
          ↓
3. Parse theme
          ↓
4. Build theme index/dependency graph
          ↓
5. Run Shopify Theme Store rules
          ↓
6. Run Accessibility rules
          ↓
7. Run Technical SEO rules
          ↓
8. Run Technical AEO rules
          ↓
9. Run Bug rules
          ↓
10. Run Internal Standards
          ↓
11. Deduplicate findings
          ↓
12. Calculate coverage
          ↓
13. Evaluate readiness
          ↓
14. Generate report
          ↓
15. Export report
          ↓
16. Developer fixes theme
          ↓
17. Upload new version
          ↓
18. Re-audit
          ↓
19. Compare with previous audit
          ↓
20. Show resolved/new/persistent issues
          ↓
21. Recalculate readiness
```

## 29. Acceptance criteria

Phase 7 is complete when:

- Submission readiness has a dedicated evaluation service.
- READY / NOT_READY / INCOMPLETE states work correctly.
- Readiness reasons are shown.
- Blocker conditions are configurable.
- Shopify requirement coverage is calculated.
- Implemented/partial/not-implemented requirements are distinguishable.
- Requirements without rules are visible.
- Partial rules clearly state their limitations.
- Rule inventory is available.
- Rule versions are tracked.
- Requirement versions/history are preserved.
- Critical rules are identifiable.
- Rule test coverage is tracked.
- Real-theme regression fixtures are established.
- Audit engine quality metrics are available.
- Requirement-to-rule traceability matrix works.
- Shopify requirement changes can be mapped to affected rules.
- Rule changes follow a safe validation workflow.
- Maintenance dashboard works.
- Final submission-readiness dashboard works.
- Historical audits remain reproducible.
- No AI API is required.
- No Voyage API is required.
- No embeddings/vector search is required.

## Explicitly out of scope

Do not build:

- AI/LLM integration
- Voyage
- Embeddings
- Vector search
- RAG
- Automatic Shopify documentation crawling
- Automatic Shopify Theme Store submission
- Shopify approval prediction
- Merchant-content SEO scoring
- Runtime browser testing
- Real Core Web Vitals scoring
