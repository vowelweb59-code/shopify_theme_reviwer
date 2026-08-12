# Phase 4 — LLM Review Layer

**Depends on:** Phase 1 (retrieval), Phase 2 (parsed files), Phase 3 (finding shape/conventions already established).
**Goal:** The judgment-call checks that static rules can't make — grounded in your actual knowledge base, not Claude's general training knowledge — running against a theme and producing `Finding` rows tagged `layer: 'llm'`.

## Scope

### Start with exactly these four checks (resist scope creep here)

1. **Alt text quality** — Phase 3 already flags *missing* alt text. This check reviews alt text that *exists* and judges whether it's descriptive (`"Blue cotton t-shirt on model, front view"`) vs. useless (`"image"`, `"photo1"`, the filename). Run per-image, batched per file rather than one call per image.
2. **JSON-LD semantic correctness** — Phase 3 flags missing/malformed JSON-LD. This check reviews JSON-LD that *does* parse and judges whether the fields are actually populated meaningfully (e.g. a `Product` schema with `"name": "{{ product.title }}"` is fine; one with hardcoded placeholder text left in from a template is not).
3. **Design-standard conformance** — retrieve relevant chunks from your ChatGPT export (`source_type: 'personal_design_standard'`) and check whether a given section/template's structure and styling choices align with what you specified there. This one is inherently fuzzier — treat findings from this check as suggestions (`severity: 'low'`/`'medium'`), not compliance failures.
4. **General code review** — a broader pass per file asking Claude to flag anything that looks like a genuine bug (logic errors, unhandled edge cases like out-of-stock or zero-inventory states, obviously copy-pasted code with leftover references to the wrong variable, etc.), grounded with retrieved Theme Store technical guidance where relevant.

Add more checks later once these four are working well end to end — don't build ten checks in parallel and debug all of them at once.

### Prompt construction pattern

For each check, the pattern is the same:
1. Build a query string describing what you're checking (e.g. `"alt text quality guidelines for product images"`).
2. Call `retrieveRelevantChunks(query, { sourceType: ... })` from Phase 1.
3. Construct a prompt with three parts: the retrieved source chunks (grounding), the relevant extracted data from `ParsedFile` (not the entire raw file — just the images/JSON-LD/etc. relevant to this check, to keep context tight), and explicit instructions to return findings in a fixed JSON shape matching the `Finding` type.
4. Parse the response, validate it against the expected shape before writing to the database (don't trust the model to always return perfect JSON — validate and retry once on parse failure before giving up and logging an error).

### Cost/latency management
- Batch related items into one call rather than one call per image/heading/etc. (e.g. all images in a file, one call).
- Cache retrieval results per check-type within a single audit run — the same query for "alt text guidelines" doesn't need to hit the vector search again for every file in the same run.
- Log token usage per audit run so you can see cost trends as you add more checks later.

## Acceptance criteria

- Run all four checks against a real theme, spot-check 10 LLM-generated findings by hand — do they hold up? Is the recommendation actually useful, or generic filler?
- Confirm findings are properly grounded — pull the `source_reference` on a handful of findings and verify the cited source chunk actually supports the finding, rather than the model hallucinating a plausible-sounding rule.
- Malformed JSON from the model doesn't crash the run — it retries once, then logs and skips gracefully.

## Explicitly out of scope

Don't build a general "chat with your theme" feature or anything beyond the four fixed checks above. This phase is about structured, repeatable findings — not an open-ended assistant.
