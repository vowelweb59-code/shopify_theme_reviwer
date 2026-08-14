# Graph Report - Shopify Theme Auditor  (2026-08-14)

## Corpus Check
- 93 files · ~1,018,551 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 504 nodes · 838 edges · 28 communities (24 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc65408c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- theme-parser/index.ts
- seed-requirements.ts
- ProjectStatusWidget.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- finding.ts
- run/route.ts
- rules.ts
- accessibility/index.ts
- cross-file/index.ts
- audit-run.ts
- audit-settings.ts
- Shopify Theme Auditor

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 19 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `buildLineIndex()` - 11 edges
6. `scripts` - 9 edges
7. `POST()` - 8 edges
8. `extractLiquidStructure()` - 8 edges
9. `parseOneFile()` - 8 edges
10. `buildTestTheme()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (28 total, 4 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.18
Nodes (13): GET(), GET(), GET(), GET(), GET(), connectToDatabase(), globalForMongoose, MongooseCache (+5 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.07
Nodes (29): htmlparser2, mongoose, next, dependencies, htmlparser2, mongoose, next, playwright (+21 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.05
Nodes (62): CSS_NAMED_COLORS, looksLikeColorValue(), DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, COLOR_PROPERTIES (+54 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.10
Nodes (29): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, buildTestTheme() (+21 more)

### Community 6 - "seed-requirements.ts"
Cohesion: 0.15
Nodes (13): GET(), Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc, requirementSchema, RULE_STATUSES, Category (+5 more)

### Community 7 - "ProjectStatusWidget.tsx"
Cohesion: 0.15
Nodes (13): ProjectStatusWidget(), Requirement, STATUS_DOT, STATUS_LABEL, geistMono, geistSans, metadata, NAV_LINKS (+5 more)

### Community 8 - "rules/page.tsx"
Cohesion: 0.40
Nodes (3): Requirement, RULE_STATUS_LABELS, SOURCE_TYPE_LABELS

### Community 9 - "reports/page.tsx"
Cohesion: 0.67
Nodes (3): AuditRunRow, formatDate(), ReportsPage()

### Community 10 - "settings.ts"
Cohesion: 0.10
Nodes (17): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+9 more)

### Community 11 - "findings.tsx"
Cohesion: 0.23
Nodes (11): AuditRunResult, AuditDiagnostics, DiagnosticsNote(), FindingRow, FindingsTable(), FindingSummary, SEVERITY_STYLES, SummaryBar() (+3 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.20
Nodes (14): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys(), isLocaleFilePath() (+6 more)

### Community 19 - "finding.ts"
Cohesion: 0.18
Nodes (11): FINDING_CATEGORIES, FINDING_LAYERS, FINDING_SEVERITIES, FindingDoc, findingSchema, RuleDoc, ruleSchema, cascadeDeleteRuns() (+3 more)

### Community 20 - "run/route.ts"
Cohesion: 0.24
Nodes (11): POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY() (+3 more)

### Community 21 - "rules.ts"
Cohesion: 0.06
Nodes (32): FindingCategory, Rule, RuleContext, RuleFinding, Severity, RunRulesSummary, BUG_RULES, duplicateAssetLoadingRule (+24 more)

### Community 22 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (26): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), contrastFindings(), ContrastSample, extractLoadedPageFacts(), extractPageFacts() (+18 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (36): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+28 more)

### Community 24 - "audit-run.ts"
Cohesion: 0.20
Nodes (9): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema, liveCheckErrorSchema (+1 more)

### Community 25 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

## Knowledge Gaps
- **204 isolated node(s):** `Requirement`, `STATUS_DOT`, `STATUS_LABEL`, `geistSans`, `geistMono` (+199 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `run/route.ts`, `seed-requirements.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Rule` connect `rules.ts` to `settings.ts`, `accessibility/index.ts`, `cross-file/index.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `parseJsonFile()` connect `parseJsonFile.ts` to `types.ts`, `theme-parser/index.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `Requirement`, `STATUS_DOT`, `STATUS_LABEL` to the rest of the system?**
  _204 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._