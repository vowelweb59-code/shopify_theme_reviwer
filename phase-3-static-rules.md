# Phase 3 — Static Rules Engine

**Depends on:** Phase 2 (needs `ParsedFile[]` output). Phase 1 helpful but not strictly required to start.
**Goal:** Every deterministic, no-judgment-required check runs against a parsed theme and produces `Finding` rows. This is the layer that catches the "this `<img>` has no `alt`" class of issue with zero LLM cost and zero false negatives.

## Scope

### Rule authoring principle (important)
Every rule must be traceable to one of two places:
1. A specific clause in Shopify's official Theme Store rules/guidelines/terms/technical guide → `category: 'Theme Store Compliance'`, and `source_reference` should quote or link the clause.
2. A general SEO/AEO/accessibility best practice not mandated by Shopify → still worth flagging, but tag it clearly as a **best practice**, not a compliance failure, so you never confuse "this will get your theme rejected" with "this would be nice to have." Use `severity: 'low'` or `'medium'` for these, reserve `'blocker'`/`'high'` for things that actually trace back to a Shopify requirement or a Lighthouse accessibility failure.

Before writing rules, pull the ingested Theme Store documentation (Phase 1) and build a checklist of every distinct requirement it states. Each rule implemented here should map to one item on that checklist. This keeps the rule set auditable — if Shopify updates their requirements, you re-ingest the doc and can diff the checklist against your rules to see what's now missing.

### Rule set for v1 (build these first)

**Accessibility / Lighthouse-aligned (compliance-critical per the review process):**
- Every image/icon/svg missing `alt` (and not `aria-hidden="true"`) → `blocker`.
- Form inputs without associated `<label>` → `high`.
- Missing `lang` attribute on `<html>` → `high`.
- Color contrast below WCAG AA threshold (compute from CSS if feasible; flag as `medium` if contrast computation isn't reliably automatable in v1 — don't fake precision you don't have).

**SEO (code-level):**
- Missing canonical tag → `medium`.
- Missing meta description tag structure on templates that should have one → `medium`.
- More than one `<h1>` per template, or heading levels skipped (h2 → h4 with no h3) → `medium`.
- Images below the fold missing `loading="lazy"` → `low`.
- Images missing explicit `width`/`height` (layout shift risk) → `medium`.

**AEO (code-level):**
- Product templates with no JSON-LD `Product` schema block → `high`.
- No `Organization` schema anywhere in the theme → `medium`.
- Blog/article templates with no `Article` schema → `medium`.
- JSON-LD block present but fails to parse as valid JSON → `blocker` (this is a code bug wearing an SEO hat).

**Bugs / Theme Store technical compliance:**
- Malformed `{% schema %}` JSON → `blocker`.
- Hardcoded user-facing strings not wrapped in translation filters → `high` (locale support is a hard Theme Store requirement).
- Deprecated Liquid objects/filters in use → `high`.
- Render-blocking `<script>` in `<head>` without `defer`/`async` → `medium`.

Don't try to implement every conceivable rule in one pass — this list is the v1 floor. Add more as you work through the Theme Store checklist from Phase 1's ingested docs.

### Implementation shape

```ts
type Rule = {
  id: string;
  category: Finding['category'];
  defaultSeverity: Finding['severity'];
  sourceReference: string;
  check: (file: ParsedFile) => Omit<Finding, 'id'|'audit_run_id'|'created_at'|'layer'>[];
};
```

Each rule is a pure function: `ParsedFile → Finding[]`. The engine runs every rule against every relevant file and flattens the results. Keep rules independent and individually testable — no shared mutable state between them.

## Acceptance criteria

- Run the full rule set against a real theme and manually verify at least 10 findings against the actual source file — no false positives on things that are clearly fine (e.g. don't flag `alt=""` on a genuinely decorative image as missing alt text — empty alt is valid when intentional).
- Every rule's `sourceReference` is filled in and points to something real, not a placeholder string.
- Rules run in well under a second per file — this layer should be near-instant since Phase 4's LLM layer is where the latency budget goes.

## Explicitly out of scope

No Claude API calls in this phase. No "is this alt text good" judgment — that's a Layer B/Phase 4 concern. This phase only checks things that are unambiguously present/absent/malformed.
