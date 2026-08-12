# Graph Report - .  (2026-08-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 165 nodes · 196 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- seed-requirements.ts
- devDependencies
- package.json
- compilerOptions
- connectToDatabase
- finding.ts
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

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 17 edges
2. `compilerOptions` - 16 edges
3. `include` - 7 edges
4. `scripts` - 6 edges
5. `AuditRun` - 5 edges
6. `FINDING_CATEGORIES` - 4 edges
7. `FINDING_SEVERITIES` - 4 edges
8. `lib` - 4 edges
9. `cascadeDeleteRuns()` - 3 edges
10. `Requirement` - 3 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (26 total, 5 thin omitted)

### Community 0 - "seed-requirements.ts"
Cohesion: 0.16
Nodes (12): Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc, requirementSchema, RULE_STATUSES, Category, main() (+4 more)

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
Nodes (13): GET(), GET(), POST(), GET(), GET(), GET(), GET(), connectToDatabase() (+5 more)

### Community 5 - "finding.ts"
Cohesion: 0.14
Nodes (16): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), FINDING_CATEGORIES, FINDING_LAYERS, FINDING_SEVERITIES (+8 more)

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

## Knowledge Gaps
- **83 isolated node(s):** `FindingDoc`, `RequirementDoc`, `RuleDoc`, `Category`, `SeedRequirement` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `connectToDatabase()` connect `connectToDatabase` to `seed-requirements.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `compilerOptions` connect `compilerOptions` to `include`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `FindingDoc`, `RequirementDoc`, `RuleDoc` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._