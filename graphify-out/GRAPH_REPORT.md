# Graph Report - Shopify Theme Auditor  (2026-08-14)

## Corpus Check
- 106 files · ~1,466,288 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 566 nodes · 958 edges · 34 communities (29 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e51bd597`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- run/route.ts
- seed-requirements.ts
- ProjectStatusWidget.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- [id]/page.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- theme-parser/index.ts
- finding.ts
- export/route.ts
- rules.ts
- liveCheck.ts
- cross-file/index.ts
- audit-run.ts
- audit-settings.ts
- Shopify Theme Auditor
- diffFindings.ts
- accessibility/index.ts
- registry.ts
- bugs/index.ts
- technical-aeo/index.ts
- accessibility/index.test.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 23 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `buildTestTheme()` - 11 edges
6. `buildLineIndex()` - 11 edges
7. `scripts` - 9 edges
8. `POST()` - 8 edges
9. `runLiveChecks()` - 8 edges
10. `runRules()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (34 total, 5 thin omitted)

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
Cohesion: 0.06
Nodes (53): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, extractHtmlStructure() (+45 more)

### Community 5 - "run/route.ts"
Cohesion: 0.15
Nodes (18): POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey() (+10 more)

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
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "[id]/page.tsx"
Cohesion: 0.13
Nodes (22): AuditRunResult, DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult, STATUS_LABEL, STATUS_STYLES (+14 more)

### Community 17 - "theme-parser/index.ts"
Cohesion: 0.07
Nodes (43): CSS_NAMED_COLORS, looksLikeColorValue(), DuplicateJsonKey, findDuplicateJsonKeys(), Frame, COLOR_PROPERTIES, extractCssStructure(), extractJsImports() (+35 more)

### Community 19 - "finding.ts"
Cohesion: 0.18
Nodes (11): FINDING_CATEGORIES, FINDING_LAYERS, FINDING_SEVERITIES, FindingDoc, findingSchema, RuleDoc, ruleSchema, cascadeDeleteRuns() (+3 more)

### Community 20 - "export/route.ts"
Cohesion: 0.20
Nodes (11): GET(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildReportHtml(), escapeHtml(), PdfFindingRow (+3 more)

### Community 21 - "rules.ts"
Cohesion: 0.15
Nodes (12): RuleContext, Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule (+4 more)

### Community 22 - "liveCheck.ts"
Cohesion: 0.16
Nodes (21): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+13 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (41): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets(), ComposedTemplate (+33 more)

### Community 24 - "audit-run.ts"
Cohesion: 0.20
Nodes (9): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema, liveCheckErrorSchema (+1 more)

### Community 25 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "diffFindings.ts"
Cohesion: 0.23
Nodes (10): GET(), computeFindingsDiff(), DiffableFinding, DiffFinding, DiffStatus, exactSignature(), FindingsDiff, FindingsDiffSummary (+2 more)

### Community 29 - "accessibility/index.ts"
Cohesion: 0.13
Nodes (11): ariaHiddenFocusableRule, BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule, focusOrderRule, formLabelRule, htmlLangRule, missingAltRule (+3 more)

### Community 30 - "registry.ts"
Cohesion: 0.21
Nodes (9): findSkippedHeadingLevels(), Rule, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, multipleH1Rule, renderBlockingScriptRule, skippedHeadingSeoRule (+1 more)

### Community 31 - "bugs/index.ts"
Cohesion: 0.14
Nodes (8): RuleFinding, BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

## Knowledge Gaps
- **225 isolated node(s):** `PhaseEntry`, `STATUS_WEIGHT`, `htmlLangRule`, `NON_LABELABLE_INPUT_TYPES`, `formLabelRule` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `export/route.ts`, `diffFindings.ts`, `run/route.ts`, `seed-requirements.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Rule` connect `registry.ts` to `technical-aeo/index.ts`, `run/route.ts`, `settings.ts`, `rules.ts`, `cross-file/index.ts`, `accessibility/index.ts`, `bugs/index.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `PhaseEntry`, `STATUS_WEIGHT`, `htmlLangRule` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.059322033898305086 - nodes in this community are weakly interconnected._