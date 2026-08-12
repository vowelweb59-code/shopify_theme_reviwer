# Graph Report - Shopify Theme Auditor  (2026-08-12)

## Corpus Check
- 55 files · ~27,851 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 173 nodes · 203 edges · 27 communities (22 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3d8d75d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- finding.ts
- devDependencies
- package.json
- compilerOptions
- connectToDatabase
- audit-run.ts
- include
- layout.tsx
- rules/page.tsx
- reports/page.tsx
- audit-settings.ts
- audit/page.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- Shopify Theme Auditor

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 17 edges
2. `compilerOptions` - 16 edges
3. `Shopify Theme Auditor` - 7 edges
4. `include` - 7 edges
5. `scripts` - 6 edges
6. `AuditRun` - 5 edges
7. `lib` - 4 edges
8. `FINDING_CATEGORIES` - 4 edges
9. `FINDING_SEVERITIES` - 4 edges
10. `cascadeDeleteRuns()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `POST()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (27 total, 5 thin omitted)

### Community 0 - "finding.ts"
Cohesion: 0.13
Nodes (18): FINDING_CATEGORIES, FINDING_LAYERS, FINDING_SEVERITIES, FindingDoc, findingSchema, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc (+10 more)

### Community 1 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+11 more)

### Community 2 - "package.json"
Cohesion: 0.11
Nodes (18): mongoose, next, dependencies, mongoose, next, react, react-dom, name (+10 more)

### Community 3 - "compilerOptions"
Cohesion: 0.11
Nodes (19): dom, dom.iterable, esnext, compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules (+11 more)

### Community 4 - "connectToDatabase"
Cohesion: 0.18
Nodes (13): GET(), GET(), GET(), GET(), GET(), GET(), connectToDatabase(), globalForMongoose (+5 more)

### Community 5 - "audit-run.ts"
Cohesion: 0.19
Nodes (10): POST(), AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), cascadeDeleteRuns(), Theme (+2 more)

### Community 6 - "include"
Cohesion: 0.20
Nodes (9): **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx, exclude (+1 more)

### Community 7 - "layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, NAV_LINKS

### Community 8 - "rules/page.tsx"
Cohesion: 0.40
Nodes (3): Requirement, RULE_STATUS_LABELS, SOURCE_TYPE_LABELS

### Community 9 - "reports/page.tsx"
Cohesion: 0.67
Nodes (3): AuditRunRow, formatDate(), ReportsPage()

### Community 10 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

## Knowledge Gaps
- **89 isolated node(s):** `Stack`, `Setup`, `Database`, `Code graph`, `Requirements knowledge base` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `connectToDatabase()` connect `connectToDatabase` to `finding.ts`, `audit-run.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `compilerOptions` connect `compilerOptions` to `include`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `Stack`, `Setup`, `Database` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `finding.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._