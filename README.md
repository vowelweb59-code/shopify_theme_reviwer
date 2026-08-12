# Shopify Theme Auditor

Internal, single-user tool for auditing Shopify themes against Theme Store requirements, accessibility, and technical SEO/AEO. No authentication — not exposed beyond localhost.

The core audit pipeline is fully deterministic — **no AI API, no embeddings, no vector search**. See `phase-0-scaffolding-updated.md` through `phase-8-testing-security-deployment-updated.md` in the repo root for the full spec (these superseded the original `phase-0-scaffolding.md` … `phase-6-polish.md` docs after a scope change). Currently: Phases 0-2 complete, **Phase 3 — Static Rules Engine** underway — theme ZIPs are parsed, evaluated against the rule set, and findings are persisted and viewable in the app.

## Stack

- Next.js (App Router) + TypeScript
- MongoDB via Mongoose (local, via Docker)
- No Voyage, no Claude/Anthropic, no OpenAI — the core app has zero AI dependency. Google Sheets export is an optional, later (Phase 5+) integration, never required.

## Setup

1. Copy the env file and adjust if needed:

   ```bash
   cp .env.example .env.local
   ```

2. Start local MongoDB:

   ```bash
   docker compose up -d
   ```

3. Install dependencies, seed the requirements knowledge base and rule catalog, and run the dev server:

   ```bash
   npm install
   npm run seed:requirements
   npm run seed:rules
   npm run dev
   ```

App runs at [http://localhost:3000](http://localhost:3000), with `/audit`, `/rules`, `/reports`, `/settings` pages navigable from the nav bar.

## Database

No migration framework — Mongoose models in `/models` define the schema (validated at the application layer via enums/required fields, not DB-level constraints).

- `Theme` — a theme that has been audited (possibly multiple times).
- `AuditRun` — one audit execution against a theme.
- `Finding` — one issue discovered during a run, always traceable to a `ruleId` (and usually a `requirementId`).
- `Requirement` — the structured, sourced knowledge base of what must be checked and why (Shopify Theme Store requirements, accessibility, technical SEO/AEO, best practices). Seeded via `npm run seed:requirements`, idempotent by `requirementId`.
- `Rule` — executable rule metadata, seeded via `npm run seed:rules` from `lib/rules/registry.ts`. Marks the requirements it covers as `implemented`.
- `AuditSettings` — minimal singleton for app-level config, expanded in later phases.

Cascading deletes (`Theme` → `AuditRun` → `Finding`) are implemented as Mongoose hooks since MongoDB has no native `ON DELETE CASCADE`.

## Code graph

[`graphify`](https://github.com/Graphify-Labs/graphify) maintains a structural code graph of this repo in `graphify-out/` (`graph.json`, the interactive `graph.html`, `GRAPH_REPORT.md`). It rebuilds automatically via a git post-commit hook (AST-only, no LLM/API key) — see `.git/hooks/post-commit`, installed with `graphify hook install`. Rebuild logs land in `~/.cache/graphify-rebuild.log`. To rebuild manually: `graphify update .`.

## Requirements knowledge base

`scripts/seed-requirements.ts` seeds ~40 requirements grounded in real, fetched source text (Shopify Theme Store requirements/accessibility/testing docs, Google Search Central structured-data docs — see `sourceUrl` on each record). Internal team standards are deliberately **not** seeded — those need to come from the team's actual conventions, not something to invent. Re-run the seed script any time; it upserts by `requirementId` and never duplicates.

## Folder structure

```
/app
  /audit                        — upload a theme, run it, see findings inline
  /rules                        — requirement knowledge base + rule coverage
  /reports, /reports/[id]       — audit run history + per-run findings detail
  /settings                     — placeholder until Phase 7
  /api/audit/run, /api/audit/[id], /api/audit/[id]/findings
  /api/rules, /api/requirements
  /api/reports, /api/reports/[id]
  /_components/findings.tsx     — shared SummaryBar/FindingsTable used by /audit and /reports/[id]
/lib
  /db               — Mongoose connection helper
  /theme-parser     — Phase 2: ZIP -> ParsedFile[]
  /rules/{shopify,accessibility,technical-seo,technical-aeo,bugs,internal}  — Phase 3 rule implementations
  /audit            — runs the enabled rule set against a ParsedFile[] (lib/audit/runRules.ts)
/models             — Theme, AuditRun, Finding, Requirement, Rule, AuditSettings
/scripts
  seed-requirements.ts, seed-rules.ts
```
