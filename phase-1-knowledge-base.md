# Phase 1 — Knowledge Base Ingestion

**Depends on:** Phase 0 (schema + app shell must exist)
**Goal:** The `/sources` page works end to end — you can add a source (paste, upload, or URL), it gets chunked and embedded, and you can see/delete it. This is the extensibility mechanism the whole project is built around, so get it solid before moving on.

## Scope

### Ingestion inputs (all four, not a subset)
1. **Paste** — a textarea, tagged with `source_type` on submit.
2. **Upload** — PDF, DOCX, TXT/MD. Extract text server-side (`pdf-parse` or similar for PDF, `mammoth` for DOCX).
3. **URL** — fetch the page, strip nav/boilerplate, extract main content text. This is how the Shopify Theme Store requirement pages and SEO/AEO research get in.
4. **ChatGPT export** — special-cased. Accept the `conversations.json` file from a ChatGPT data export, extract just the conversation you specify (or all of them if simpler for v1), flatten into plain text preserving the Q&A structure so context isn't lost.

### Chunking
- Chunk by heading/section boundaries, not fixed character counts — a chunk should be a coherent unit (e.g. one requirement, one FAQ answer, one design-standard paragraph), not an arbitrary 500-char slice that cuts a sentence in half.
- Store `heading_path` per chunk (e.g. `"Technical requirements > Performance > Image optimization"`) so retrieval results are traceable back to context, and so findings can cite `source_reference` meaningfully later.
- Target chunk size: roughly 150–400 words. If a section is much longer, split at sub-headings or paragraph breaks rather than mid-thought.

### Embedding
- Pick one provider and commit — Voyage AI (pairs naturally with Claude, has a free tier) is the recommended default. OpenAI embeddings work equally well if you'd rather standardize on one vendor.
- Embed each chunk on ingestion, store the vector in `source_chunks.embedding`.
- Batch embedding calls rather than one-at-a-time if a source produces many chunks.

### `/sources` UI
- Table: name, type, origin, chunk count, date added, active toggle, delete button.
- "Add source" form with a type selector matching the four `source_type` values and the four ingestion inputs above.
- Re-index button per source (re-chunk + re-embed without re-uploading — useful if you tweak the chunking logic later).

### Seed data for this phase
Before moving to Phase 2, actually ingest:
- Shopify's Theme Store rules, guidelines, terms of service, and technical/developer guide (fetch the relevant shopify.dev pages via URL ingestion).
- Your ChatGPT export with theme design requirements.
- A handful of SEO/AEO reference articles.

This gives Phase 4 (LLM review) real data to retrieve against instead of an empty table.

## Retrieval function (build now, used later)

Expose a single function other phases will call:

```ts
async function retrieveRelevantChunks(query: string, opts?: { sourceType?: string; topK?: number }): Promise<Chunk[]>
```

Cosine similarity search against `source_chunks.embedding`, optionally filtered by `source_type` (e.g. Phase 3's rule-authoring step will want to filter to `theme_store_requirement` only).

## Acceptance criteria

- All four ingestion paths work and produce sensible chunks (spot-check by eye — pull up 5 random chunks per source and confirm they read as coherent units).
- `retrieveRelevantChunks("alt text requirements")` returns chunks that are actually about alt text, not noise.
- Deleting a source cascades and removes its chunks (`on delete cascade` from Phase 0 schema handles this — just confirm it).

## Explicitly out of scope

Don't build the audit engine or wire retrieval into any LLM review logic yet — that's Phase 4. This phase only needs to prove ingestion and retrieval work in isolation.
