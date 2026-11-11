# Phase 6 — Re-Audit, Diff & Finding Lifecycle

**Depends on:** Phases 0–5

**Goal:** Allow the user to audit a newer version of the same Shopify theme and clearly determine which findings were resolved, which remain, and which are newly introduced.

This phase turns the application from a one-time scanner into a development workflow tool.

The core flow is:

```text
Theme v1
   ↓
Audit v1
   ↓
Findings v1

Developer fixes theme
   ↓

Theme v2
   ↓
Audit v2
   ↓
Findings v2

        ↓

Compare v1 ↔ v2

        ↓

Resolved
Still Present
New
Changed
```

No AI API, Voyage, embeddings, vector search, or external inference service is required.

## 1. Theme version model

A single logical theme can have multiple uploaded versions/audit runs.

Example:

```text
Theme:
Adorn

Versions:
v1
v2
v3
v4
```

Do not treat every ZIP as an unrelated theme when the user is clearly auditing a newer version of the same theme.

The system should maintain:

```text
Theme
  ├── Audit Run 1
  ├── Audit Run 2
  ├── Audit Run 3
  └── Audit Run 4
```

## 2. Audit run metadata

Extend `audit_runs` with version/comparison metadata.

Suggested fields:

```ts
type AuditRun = {
  _id: ObjectId;
  themeId: ObjectId;

  versionLabel?: string;

  status: 'pending' | 'running' | 'complete' | 'failed';

  previousAuditRunId?: ObjectId;

  parserVersion?: string;
  ruleEngineVersion?: string;

  sourceFileName?: string;

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

The `previousAuditRunId` provides an explicit comparison relationship.

## 3. Selecting the baseline audit

When starting an audit for an existing theme, the application should allow:

```text
Compare with:
○ No previous audit
○ Most recent audit
○ Select previous audit
```

Default to the most recent completed audit for that theme.

Do not compare against failed or incomplete audits unless explicitly selected.

## 4. Finding identity

Finding comparison must not rely only on line numbers.

A line can move when code is added or removed.

Create a normalized finding identity using stable information such as:

```text
ruleId
+
category
+
filePath
+
normalized finding signature
```

Example:

```ts
type FindingSignature = {
  ruleId: string;
  category: FindingCategory;
  filePath: string;
  normalizedMessage: string;
};
```

Where useful, include a normalized code/source signature.

## 5. Finding normalization

Normalize finding text before comparison.

Normalization can include:

- Lowercasing
- Removing excessive whitespace
- Normalizing quote styles
- Normalizing dynamic values
- Removing line numbers
- Normalizing file separators

Do not remove meaningful identifiers that distinguish two separate findings.

## 6. Matching algorithm

Use a deterministic multi-stage matching strategy.

### Stage 1 — Exact signature

Match:

```text
ruleId
+
category
+
filePath
+
normalized message
```

### Stage 2 — Stable rule/location match

If the message changed slightly but:

```text
ruleId
+
category
+
filePath
```

match, compare nearby source context.

### Stage 3 — Source-context match

If the file changed line numbers, use normalized source snippets or source signatures where available.

### Stage 4 — Unmatched

If no reliable match exists:

```text
old finding → resolved
new finding → new
```

Do not use vague text similarity as the sole basis for automatically declaring an issue resolved.

The goal is reliable diffing, not aggressive matching.

## 7. Diff states

Each finding in the comparison should receive one of:

```ts
type DiffStatus =
  | 'resolved'
  | 'still_present'
  | 'new'
  | 'changed'
  | 'unchanged';
```

### Resolved

Present in the previous audit and no reliable match exists in the new audit.

### Still present

Present in both audits with substantially the same issue.

### New

Present only in the new audit.

### Changed

The same underlying rule/location appears to remain, but important details changed.

Examples:

- Severity changed
- Recommendation changed
- Finding message changed
- Source context changed

### Unchanged

The finding is effectively identical between audits.

For the user-facing summary, `still_present` and `unchanged` may be grouped as persistent findings.

## 8. Diff summary

Display:

```text
Previous findings: 42
Current findings: 16

Resolved:       28
Still present:  12
New:             2
Changed:         1
```

Also show severity changes.

Example:

```text
Blockers
Previous: 3
Current: 1

Resolved blockers: 2
New blockers: 0
```

And category changes:

```text
Shopify Compliance
Resolved: 15
New: 1

Accessibility
Resolved: 7
New: 0
```

## 9. Re-audit workflow

The user flow should be:

```text
Open theme
   ↓
View latest audit
   ↓
Upload new ZIP
   ↓
Choose previous audit
   ↓
Run audit
   ↓
Compare results
   ↓
View changes
```

Do not require the user to manually enter a version number, although an optional version label can be provided.

## 10. Finding lifecycle

Findings should remain historically preserved.

Do not delete the original finding when it disappears from a later audit.

Instead:

```text
Audit 1
Finding A
status: open

Audit 2
Finding A
not detected

Diff:
Finding A → resolved
```

This allows the user to understand the progression of the theme.

## 11. Manual finding status

The reporting layer supports:

```text
open
resolved
ignored
```

Phase 6 must distinguish manual status from automatic diff status.

For example:

```text
Manual status:
ignored

Diff status:
still_present
```

The system should not overwrite the user's manual decision simply because the issue appears again.

## 12. Ignored findings

If a user ignores a finding:

```text
Ignored
Reason:
Approved exception for this theme.
```

When the same finding appears in a later audit, preserve the ignore state where a reliable match exists.

However, if the rule or finding signature changes substantially, require the user to review the new finding.

## 13. Reintroduced findings

A previously resolved finding can return.

Example:

```text
Audit 1:
Missing alt → open

Audit 2:
Missing alt → resolved

Audit 3:
Missing alt → new/reintroduced
```

The report should identify this as a reintroduced issue when historical matching can establish it.

Suggested state:

```ts
type HistoricalState =
  | 'first_seen'
  | 'persistent'
  | 'resolved'
  | 'reintroduced';
```

This is optional for the first implementation but should be supported by the data model.

## 14. Rule changes between audits

The rule engine itself may change between audits.

Example:

```text
Audit 1:
Rule A version 1

Audit 2:
Rule A version 2
```

The comparison should record:

```text
ruleEngineVersion
parserVersion
rule version
```

If a finding exists only because a new rule was introduced, it should be identifiable as:

```text
New rule finding
```

rather than automatically interpreted as a newly introduced theme defect.

## 15. Requirement changes

Shopify requirements may evolve.

If a requirement is updated:

```text
Requirement:
SHOPIFY-A11Y-001

Version:
2
```

historical audits must retain the original requirement/source metadata used at that time.

Do not rewrite historical audit findings when the current requirement changes.

## 16. Diff API

Add endpoints similar to:

```text
GET /api/audit/[id]/diff
GET /api/audit/[id]/history
POST /api/audit/[id]/compare
```

The API should return:

```ts
type AuditDiff = {
  previousAuditId: string;
  currentAuditId: string;

  summary: {
    previousTotal: number;
    currentTotal: number;

    resolved: number;
    stillPresent: number;
    new: number;
    changed: number;
  };

  findings: DiffFinding[];

  severityChanges: SeverityChange[];

  categorySummary: CategoryDiffSummary[];
};
```

## 17. Diff UI

Create a comparison view:

```text
Adorn

Audit #12 → Audit #13

42 findings → 16 findings

✓ 28 resolved
⚠ 12 still present
+ 2 new
↔ 1 changed
```

### Tabs

```text
All
Resolved
Still Present
New
Changed
```

### Resolved finding

Show:

```text
✓ RESOLVED

Missing alt attribute

sections/product-card.liquid
Line 42 → fixed
```

Where possible, show the previous source and current source.

### New finding

Show:

```text
NEW

Broken translation key

sections/cart-drawer.liquid
Line 87
```

### Still present

Show:

```text
STILL PRESENT

Missing canonical implementation

layout/theme.liquid
```

## 18. Before/after source comparison

Where both audits have source snapshots or accessible source context, display:

```text
Before
-------
<img src="...">

After
-----
<img src="..." alt="{{ product.title }}">
```

This is especially useful for verifying resolved issues.

Do not require complete ZIP persistence just to implement the first diff version. If source snapshots are not stored, use the available audit source context and file metadata.

## 19. Historical audit timeline

Create a theme history view:

```text
Adorn

Aug 12
Audit #4
16 findings
↓ 26 from previous

Aug 10
Audit #3
42 findings

Aug 08
Audit #2
57 findings

Aug 05
Audit #1
73 findings
```

This provides a simple quality-progress view.

## 20. Regression detection

The diff must highlight newly introduced problems.

Example:

```text
Previous blockers: 0
Current blockers: 2

⚠ 2 new blockers introduced
```

This should be prominent in the UI.

The purpose is not only to show progress but also to prevent fixes in one area from silently introducing new compliance problems elsewhere.

## 21. Submission readiness after re-audit

After every comparison, recalculate readiness using the current audit.

Example:

```text
Previous:
NOT READY — 3 blockers

Current:
NOT READY — 1 blocker

Progress:
2 blockers resolved
```

If all configured mandatory checks pass:

```text
READY
```

If coverage is incomplete:

```text
INCOMPLETE
```

The system must not show READY when the current rule coverage is insufficient for a meaningful readiness claim.

## 22. Exporting diffs

Extend Phase 5 export support to include comparison reports.

### CSV

Fields:

```text
Diff Status
Severity
Category
Rule ID
Requirement ID
File
Previous Line
Current Line
Previous Finding
Current Finding
Source
```

### XLSX

Suggested sheets:

```text
Diff Summary
Resolved
Still Present
New
Changed
Severity Changes
Category Changes
```

### JSON

Export the complete `AuditDiff`.

## 23. Comparison tests

Create deterministic fixtures for:

### Resolved finding

Old theme contains issue.
New theme fixes issue.

Expected:

```text
resolved
```

### Persistent finding

Issue exists in both versions.

Expected:

```text
still_present
```

### New finding

Only new theme contains issue.

Expected:

```text
new
```

### Changed finding

Same rule/location but severity/message/source changed.

Expected:

```text
changed
```

### Moved line

Issue remains but line number changes.

Expected:

```text
still_present
```

### File rename

If the same source can be reliably identified after a file rename, match it; otherwise treat it conservatively as changed/new rather than guessing.

### Rule version change

New rule creates a finding that did not exist in the old rule set.

Expected to be identifiable as a rule-version-related new finding.

### Reintroduced finding

Issue disappears and later returns.

Expected historical state:

```text
reintroduced
```

## 24. False-positive prevention

Diffing must be conservative.

Never automatically mark a finding resolved solely because:

- Line number changed
- File moved
- Message wording changed
- Rule implementation changed

Require enough stable evidence to establish that the original issue no longer exists.

If confidence is insufficient:

```text
Needs review
```

can be used internally rather than forcing a wrong state.

## 25. Acceptance criteria

Phase 6 is complete when:

- Multiple audit runs can belong to one theme.
- A new audit can select a previous audit as its baseline.
- Finding signatures are stable and line-number independent.
- Findings can be matched deterministically across audits.
- Resolved findings are identified.
- Persistent findings are identified.
- New findings are identified.
- Changed findings are identified.
- Severity changes are detected.
- Category-level changes are summarized.
- Historical findings remain preserved.
- Manual `open/resolved/ignored` status is not confused with automatic diff status.
- Ignored findings can remain ignored when reliably matched.
- Reintroduced issues can be identified where history supports it.
- Rule/parser versions are stored.
- Historical requirement metadata is preserved.
- Diff APIs work.
- Diff UI works.
- Before/after source context is shown where available.
- Regression/new blocker detection is prominent.
- Submission readiness is recalculated for the current audit.
- Diff exports work.
- Tests cover resolved, persistent, new, changed, moved-line, rule-version, and reintroduced cases.
- No AI API is required.
- No Voyage API is required.
- No embeddings/vector search is required.

## Explicitly out of scope

Do not build:

- AI/LLM-assisted diffing
- Semantic vector similarity
- External AI services
- Shopify Theme Store submission API
- Automatic theme submission
- Runtime/browser comparison
- Performance comparison using real Core Web Vitals
- Merchant-content comparison
