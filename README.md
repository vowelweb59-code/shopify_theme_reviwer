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

App runs at [http://localhost:3000](http://localhost:3000), with `/audit`, `/rules`, `/reports`, `/enhancements`, `/settings` pages navigable from the nav bar. `/enhancements` starts empty until you also run `npm run seed:enhancements` and/or `npm run seed:native-capabilities` — both optional, see "Future updates" below.

## Database

No migration framework — Mongoose models in `/models` define the schema (validated at the application layer via enums/required fields, not DB-level constraints).

- `Theme` — a theme that has been audited (possibly multiple times).
- `AuditRun` — one audit execution against a theme.
- `Finding` — one issue discovered during a run, always traceable to a `ruleId` (and usually a `requirementId`).
- `Requirement` — the structured, sourced knowledge base of what must be checked and why (Shopify Theme Store requirements, accessibility, technical SEO/AEO, best practices). Seeded via `npm run seed:requirements`, idempotent by `requirementId`.
- `Rule` — executable rule metadata, seeded via `npm run seed:rules` from `lib/rules/registry.ts`. Marks the requirements it covers as `implemented`.
- `AuditSettings` — minimal singleton for app-level config, expanded in later phases.
- `EnhancementPoint` — optional, non-blocking capability trends measured from Shopify Theme Store release notes. Deliberately a **separate collection** from `Requirement`; see "Future updates" below.

Cascading deletes (`Theme` → `AuditRun` → `Finding`) are implemented as Mongoose hooks since MongoDB has no native `ON DELETE CASCADE`.

## Code graph

[`graphify`](https://github.com/Graphify-Labs/graphify) maintains a structural code graph of this repo in `graphify-out/` (`graph.json`, the interactive `graph.html`, `GRAPH_REPORT.md`). It rebuilds automatically via a git post-commit hook (AST-only, no LLM/API key) — see `.git/hooks/post-commit`, installed with `graphify hook install`. Rebuild logs land in `~/.cache/graphify-rebuild.log`. To rebuild manually: `graphify update .`.

## Requirements knowledge base

`scripts/seed-requirements.ts` seeds ~107 requirements, most grounded in real, fetched source text (Shopify Theme Store requirements/accessibility/testing docs, Google Search Central structured-data docs — see `sourceUrl` on each record). A handful (`sourceType: "internal_standard"`, `category: "Internal Standard"`) are deliberately **not** sourced from a fetched doc — those come from the team's own actual conventions/quality bar instead (e.g. `INTERNAL-PRESET-SYNC-001` below), each with a `notes` field saying plainly that it's not an official Shopify requirement. Re-run the seed script any time; it upserts by `requirementId` and never duplicates.

## Live checks against real demo stores

`/audit` accepts one or more **preset demo store URLs** — a theme ZIP can ship several presets (style variants of the same codebase), each typically published as its own separately live Shopify store (confirmed against the Theme Store's own multi-preset themes, e.g. Prestige: `themes.shopify.com/themes/prestige/presets/prestige` embeds a real live demo URL distinct from its sibling presets'). Every preset gets the same Playwright-based live-check battery (`lib/audit/liveCheck.ts`: real rendered contrast, real rendered JSON-LD, canonical/meta description, responsive reachability) run against it — one browser, a fresh context per preset, not N separate browser processes — with results labeled by preset (`Finding.presetLabel`). A single preset failing to load (`AuditRun.liveCheckErrors`, plural) never prevents the others from running.

When 2+ presets succeed, an additional **`comparePresets`** check runs: the first-listed preset is treated as the baseline ("the main theme," per how this was originally framed), and every other preset is compared against it for structural drift — rendered section count (via `.shopify-section` DOM wrappers, a universal non-optional Shopify layout convention, so this needs no theme-specific markup knowledge), missing JSON-LD types, and missing canonical/meta description. This is a **live rendered comparison**, not a `config/settings_data.json` diff — confirmed with the user this was the intended design, since each preset is a genuinely separate published theme install with its own independently admin-configured content (verified: two different presets of the same Theme Store theme resolve to two different `.myshopify.com` subdomains), so comparing actual rendered output catches real drift a static JSON diff can't. Findings from this comparison trace to a new internal-standard requirement, `INTERNAL-PRESET-SYNC-001` (see above) — this is the user's own quality bar (informed by studying top multi-preset Theme Store themes), not a documented Shopify rule.

`AuditRun.demoStorePresets`/`liveCheckErrors` (plural) are what every new run populates; the older singular `demoStoreUrl`/`liveCheckError` fields stay untouched for pre-existing runs' historical display, and the API still accepts the old single-URL form field as a fallback (wrapped into a 1-item preset list) for any caller that hasn't moved to the plural field yet.

## Future updates (enhancement points)

`/enhancements` tracks **optional** capability points from two different kinds of evidence (`EnhancementPoint.source`) — things competing themes already ship (`theme-store-trend`) and documented Shopify platform features a theme can build without installing any app (`native-capability`). Both are explicitly *not* approval requirements: nothing on that page affects submission readiness, requirement coverage, or any finding.

This isolation is the reason `EnhancementPoint` is its own collection rather than a flagged subset of `Requirement`. `app/api/reports/[id]/route.ts` and `app/api/reports/[id]/export/route.ts` both call `Requirement.find()` **unfiltered** and feed the result straight into coverage %, which readiness thresholds are compared against. Adding 47 optional records there would have silently dropped every theme's coverage and could have flipped passing themes to `NOT_READY`.

Unlike the requirements knowledge base, these numbers are *measured*, not transcribed from docs:

1. `scripts/research/harvest-release-notes.mjs` walks the public Theme Store listing (~53 pages) to collect every theme slug, then pulls each theme's full release-note history from the store's own version-details endpoint. Raw output lands in `.scratch/release-notes/` (gitignored, ~50MB) so it can be re-parsed without re-fetching.
2. `scripts/research/aggregate-release-notes.mjs` reduces that to `data/theme-trend-points.json` — per capability: how many distinct themes ship it, when it first and last appeared, and verbatim sample notes as evidence. Topic regexes live in `scripts/research/topics.mjs` and were derived from the highest-frequency n-grams actually present in the corpus.
3. `npm run seed:enhancements` joins that measured data to hand-written `description`/`auditHint` copy in `scripts/seed-enhancement-points.ts`.

```bash
npm run harvest:trends      # steps 1 + 2 (network; resumable, skips already-harvested themes)
npm run seed:enhancements   # step 3 (idempotent by pointId)
```

Current corpus: **335 themes, 5,771 versions, 47,977 release-note entries** → 55 points (47 from the initial pass, +8 mined deeper from the same corpus on 2026-09-11 — no re-fetch needed, see `scripts/research/topics.mjs`'s "Round 2" comment). Note the store's advertised "1,262 themes" counts preset/style *cards*; there are 335 distinct themes behind them, and release notes are per theme.

Adding a point is additive and safe to do repeatedly: append to `TOPICS` in `topics.mjs` (checking new candidates against the existing regexes first — see the overlap-check approach in that file's Round 2 comment — so you don't add a near-duplicate of something already covered), add matching hand-written copy to `COPY` in `seed-enhancement-points.ts`, add a matching entry to `ENHANCEMENT_DETECTORS` in `lib/audit/enhancementDetectors.ts`, then `npm run harvest:trends && npm run seed:enhancements`. Existing points' stats and every theme's triage status are untouched by an additive run. Skipping the detector step (or adding a point without re-running audits against it) isn't silently misleading — the report tab's "Not yet checked" bucket (see below) is exactly for a point that exists but has no detection result for a given run, so it never gets mistaken for "confirmed absent".

Points are bucketed by measured adoption — `established` (>50% of themes), `common` (20–50%), `emerging` (5–20%), `experimental` (<5%) — and each carries a per-theme triage status (`backlog`/`planned`/`implemented`/`dismissed`). **Re-seeding never overwrites a status or note**, so a triage decision survives a refreshed harvest. Tier thresholds/labels live in one place, `lib/enhancements/tiers.ts` (kept mongoose-free so the client page can import it), and both `scripts/seed-enhancement-points.ts` and the UI read from it.

### Native capabilities (no app required)

14 points (2026-09-11), each grounded in a real shopify.dev doc: `data/native-capabilities.json`, hand-curated (not aggregated) and seeded via `npm run seed:native-capabilities` (idempotent by `pointId`, same additive/non-destructive contract as the trend seed). Deliberately excludes Shopify Functions/Extensions and Shopify Flow — those still require deploying an app (even a free first-party one) — scoped strictly to pure Liquid/JS/CSS/theme-settings capabilities, so "no app" actually means zero app installs of any kind.

Every point names the specific Liquid object/tag/filter that implements it and what paid app category it replaces (`appCategoryReplaced`), and is honestly flagged `nativeCapabilityCompleteness: "full"` or `"partial"` — e.g. custom line-item properties fully replace a personalizer app's *data capture*, but the polished date-picker/engraving *UI* still needs hand-building. Detection reuses the exact same pipeline as trend points (`lib/audit/enhancementDetectors.ts`) — for these, precision is much higher, since a theme either calls `color_contrast`/`metafield_tag`/`payment_terms` somewhere in its source or it doesn't, unlike matching natural-language release-note phrasing.

**Adoption is also measured for 12 of the 14**, reusing the exact same corpus/pipeline as the trend points — e.g. native contact forms (45.1%, 151/335), the password/"coming soon" page (27.8%, 93/335), unit pricing (20.6%, 69/335), down to genuinely-0/335 for the newest/most invisible ones (llms.txt, custom robots.txt, hreflang, automatic metafield rendering — themes don't write release notes about things that are either brand-new or automatic-by-default). **The other 2 are deliberately left unmeasured** (`adoptionTier: null`, shown in the UI as "Adoption not reliably measurable" rather than a fake 0%): an overlap check against the existing 55 trend points (same rigor used when the point set grew from 47→55) showed "Shop Pay Installments" and "color_contrast" release-note matches were really just re-detecting notes already counted by a broader existing point ("Shop Pay and accelerated checkout", "Accessibility remediation"), not a distinct signal — see `UNRELIABLE_ADOPTION_MEASUREMENT` in `scripts/seed-native-capabilities.ts` for the exact overlap percentages and reasoning.

Researched via a forked agent instructed to fetch real shopify.dev pages only (never blogs — a first attempt at this via WebSearch surfaced nothing but SEO content-farm "2026 guide" spam, explicitly rejected) and cross-check every candidate against the existing trend-point list to avoid re-describing something already covered. The two most surprising, independently spot-checked findings: **`llms.txt.liquid`/`agents.md.liquid`** (a native alternative to "AI SEO" apps, first documented mid-2026) and the **`color_contrast`** filter (computes a real WCAG contrast ratio in Liquid).

### Per-theme detection

Every audit report also gets a **Future updates** tab showing which of these points this specific theme's source already has. This is heuristic pattern-matching (`lib/audit/enhancementDetectors.ts` + `lib/audit/detectEnhancements.ts`), same spirit as `lib/rules/shopify/features.ts`'s presence checks — a regex match is evidence, not proof; a miss doesn't prove absence, and a hit doesn't prove correctness. It runs alongside the rule engine in `app/api/audit/run/route.ts` and is captured once onto `AuditRun.enhancementDetections`, because (like everywhere else in this app) the original theme ZIP is never persisted — this is the only chance to check for these patterns. **Never affects severity, coverage, or readiness.**

A run from before this feature shipped has no `enhancementDetections` at all; the report tab detects this (`enhancementDetectionAvailable: false`) and tells the user to re-run the audit rather than implying every point is absent. A run from before a *specific* point existed is different but handled the same way: that one point has no entry in `enhancementDetections` even though the run has others, so it lands in a **"Not yet checked"** bucket rather than "not detected" or vanishing from the list — found (and fixed) the day the point count grew from 47 to 55, by actually re-checking an existing older audit run against the newly expanded list rather than assuming it would just work.

⚠️ **Mongoose + `next dev` gotcha**: adding a field to a model (like `AuditRun.enhancementDetections`) requires an actual dev-server restart, or `mongoose.models.AuditRun` keeps serving the old cached schema and the new field silently never appears — confirmed a third time during this feature's build. On Windows, `pkill -f "next dev"` from Git Bash can fail to kill the real process while `npm run dev` happily starts a *second* server on a fallback port; verify with `Get-Process node` / kill by PID (`Stop-Process -Id <pid> -Force`), and confirm the fix by checking the actual API response, not just that a new process started.

### Google Sheets export

Two export surfaces, both persistent (one spreadsheet reused and updated in place, not a new one per export):

- `/enhancements` has its own "Export to Google Sheet" button — a standalone spreadsheet, one tab per category (`Content & Media`, `Merchandising`, …), mixing `theme-store-trend` and `native-capability` points within a tab. The spreadsheet id/url persist on a new singleton model, `EnhancementSheet` (`models/enhancement-sheet.ts`) — global, not per-theme, following the same "one small dedicated model per concern" convention as `ReadinessConfig`/`GoogleAuth` rather than growing the (already unused) `AuditSettings` model.
- Every theme's own audit-checklist spreadsheet (the "Google Sheet" button on `/reports/[id]`) gets an extra **"Future Updates"** tab alongside its existing per-category finding tabs — the same per-theme detection data as the on-screen report tab (which of the backlog's points *this* theme's audited source already has), not the unscoped global list. One consolidated tab, not one per category — 11 more tabs on top of a theme's existing 6 would make an already multi-tab workbook unwieldy, and it mirrors the on-screen per-theme tab's own single-view framing. Built and appended *after* the checklist tabs' diff/merge step, never through it: an enhancement point's `status` is already the database's source of truth, so this tab is always a full rewrite, with no "resolved, carried forward" concept the way a finding row has.

Both reuse `lib/google/sheetsExport.ts`'s `createGoogleSheet`/`updateGoogleSheet` — the substantial create/update/temp-title-swap orchestration — rather than duplicating it. Getting the per-theme case working required a second refactor of that shared code: a spreadsheet can now mix tabs with genuinely different column schemas in *one* export call (a theme's checklist tabs *and* its Future Updates tab together), which a single call-level formatting option couldn't express. Each `SheetTab` (`lib/export/sheetRows.ts`) now optionally carries its own `booleanColumnIndex`/`formatting`, defaulting to the audit checklist's existing behavior when omitted — reusing the checklist's hardcoded "Resolved"-column rewrite unmodified on a schema without one would have corrupted a real data column (e.g. `Themes`, `"151/335"`) by trying to parse it as a boolean. `lib/export/enhancementSheetRows.ts` + `lib/google/enhancementSheetFormatting.ts` hold the schema-specific column lists, row-building, and formatting (tier/status/detected color-coding, a shared `buildFormattingForColumns` core so the two enhancement-schema tab shapes don't duplicate the whole formatting function). Verified after each refactor pass that the *existing* audit-checklist export still works byte-for-byte the same, not just that the new tab does — both live-tested via the actual UI buttons, not just the API.

## Folder structure

```
/app
  /audit                        — upload a theme, run it, see findings inline
  /rules                        — requirement knowledge base + rule coverage
  /reports, /reports/[id]       — audit run history + per-run findings detail
  /enhancements                 — optional capability trends ("Future updates"), non-blocking
  /settings                     — placeholder until Phase 7
  /api/audit/run, /api/audit/[id], /api/audit/[id]/findings
  /api/rules, /api/requirements, /api/enhancements (GET list/filter, PATCH triage), /api/enhancements/export/google-sheet
  /api/reports, /api/reports/[id]
  /_components/findings.tsx     — shared SummaryBar/FindingsTable used by /audit and /reports/[id]
  /_components/enhancementReport.tsx  — the report page's "Future updates" tab
/lib
  /db               — Mongoose connection helper
  /theme-parser     — Phase 2: ZIP -> ParsedFile[]
  /rules/{shopify,accessibility,technical-seo,technical-aeo,bugs,internal}  — Phase 3 rule implementations
  /audit            — runs the enabled rule set against a ParsedFile[] (lib/audit/runRules.ts)
                       + per-theme enhancement-point detection (detectEnhancements.ts, enhancementDetectors.ts)
                       + enhancementReport.ts (joins detections to points; shared by the report route and its sheet export)
  /enhancements/tiers.ts  — single source of truth for adoption-tier thresholds/labels (mongoose-free)
/models             — Theme, AuditRun, Finding, Requirement, Rule, AuditSettings, EnhancementPoint, EnhancementSheet
/scripts
  seed-requirements.ts, seed-rules.ts, seed-enhancement-points.ts, seed-native-capabilities.ts
  /research         — one-off Theme Store release-note harvest + aggregation (not app runtime)
/data
  theme-trend-points.json       — committed aggregation output the trend-point seed reads
  native-capabilities.json      — hand-curated, doc-sourced native-capability points
```
