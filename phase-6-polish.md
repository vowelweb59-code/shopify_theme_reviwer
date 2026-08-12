# Phase 6 — Polish

**Depends on:** Phases 0–5 all working end to end. This phase only makes sense once you've actually run a handful of real audits and have real data to build these features against.

## Scope

### Re-audit / diff view
- On `/reports`, when a theme has more than one audit run, show a diff: findings resolved since the last run, findings that are new, findings that persisted unchanged.
- Match findings across runs by `(file_path, category, finding text similarity)` rather than exact string match — line numbers shift as code changes, so line number alone isn't a reliable match key.
- Surface this in the Google Sheet's Trend section too (referenced but deferred from Phase 5) — a simple table of run date vs. counts by severity is enough for v1, a chart is a nice-to-have.

### Severity gating
- A clear "ready to submit" indicator: zero `blocker` findings across both `Theme Store Compliance` and `Accessibility` categories.
- Show this prominently on the `/reports` page for the latest run per theme — you should be able to glance at the list and know which themes are actually submission-ready without opening every sheet.

### Source re-indexing UI improvements
- From Phase 1, re-indexing exists but is probably bare-bones. Polish: show last-indexed date, show a diff of chunk count before/after re-index, allow re-indexing all active sources in one action when you know Shopify has updated their docs.

### Rule set gap tracking
- Building on Phase 3's checklist-mapping approach: surface which items from the ingested Theme Store documentation don't yet have a corresponding rule, so you can see rule-set coverage at a glance and prioritize what to build next.

## Acceptance criteria

- Re-audit the same theme twice with a real code change in between (fix one alt tag) and confirm the diff view correctly shows that finding as resolved and nothing else as falsely changed.
- The submission-readiness indicator is correct against your own manual judgment of a few themes you already know the state of.

## Explicitly out of scope

Nothing further planned beyond this — treat this as the last phase unless something new comes up once you're using the tool day to day.
