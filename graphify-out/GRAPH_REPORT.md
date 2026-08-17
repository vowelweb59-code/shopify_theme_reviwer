# Graph Report - Shopify Theme Auditor  (2026-08-17)

## Corpus Check
- 117 files · ~1,474,130 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 626 nodes · 1084 edges · 34 communities (30 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a115053`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- run/route.ts
- requirement.ts
- ProjectStatusWidget.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- theme-parser/index.ts
- finding.ts
- xlsx.ts
- shopify/index.ts
- accessibility/index.ts
- cross-file/index.ts
- rules.ts
- export/route.ts
- Shopify Theme Auditor
- diffFindings.ts
- pdf.ts
- registry.ts
- bugs/index.ts
- technical-aeo/index.ts
- csv.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 25 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `buildTestTheme()` - 11 edges
6. `buildLineIndex()` - 11 edges
7. `GET()` - 10 edges
8. `computeReadiness()` - 9 edges
9. `scripts` - 9 edges
10. `runLiveChecks()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/findings/[id]/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (34 total, 4 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.16
Nodes (14): GET(), GET(), GET(), GET(), GET(), connectToDatabase(), globalForMongoose, MongooseCache (+6 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.06
Nodes (31): exceljs, htmlparser2, mongoose, next, dependencies, exceljs, htmlparser2, mongoose (+23 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.05
Nodes (55): CSS_NAMED_COLORS, looksLikeColorValue(), DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, ANIMATION_PROPERTIES (+47 more)

### Community 5 - "run/route.ts"
Cohesion: 0.11
Nodes (29): extractSourceSnippet(), POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), loadEnabledRules(), runAuditRules(), FindingCategory (+21 more)

### Community 6 - "requirement.ts"
Cohesion: 0.17
Nodes (13): FINDING_CATEGORIES, FINDING_SEVERITIES, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc, requirementSchema, RULE_STATUSES (+5 more)

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

### Community 11 - "findings.tsx"
Cohesion: 0.06
Nodes (43): AuditRunResult, CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), DiffFindingDetail, DiffFindingRow (+35 more)

### Community 17 - "theme-parser/index.ts"
Cohesion: 0.07
Nodes (42): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), extractJsImports(), parseOneFile() (+34 more)

### Community 19 - "finding.ts"
Cohesion: 0.09
Nodes (22): PATCH(), AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema (+14 more)

### Community 20 - "xlsx.ts"
Cohesion: 0.32
Nodes (6): CoverageResult, addFindingsSheet(), buildReportXlsx(), FINDING_COLUMNS, XlsxFinding, XlsxSummary

### Community 21 - "shopify/index.ts"
Cohesion: 0.15
Nodes (11): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+3 more)

### Community 22 - "accessibility/index.ts"
Cohesion: 0.07
Nodes (34): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+26 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (36): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+28 more)

### Community 24 - "rules.ts"
Cohesion: 0.28
Nodes (4): RuleContext, RuleFinding, CROSS_FILE_RULES, BASE_LAYOUT

### Community 25 - "export/route.ts"
Cohesion: 0.17
Nodes (16): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), computeReadiness() (+8 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "diffFindings.ts"
Cohesion: 0.23
Nodes (10): GET(), computeFindingsDiff(), DiffableFinding, DiffFinding, DiffStatus, exactSignature(), FindingsDiff, FindingsDiffSummary (+2 more)

### Community 29 - "pdf.ts"
Cohesion: 0.38
Nodes (5): buildReportHtml(), escapeHtml(), PdfFindingRow, PdfSummary, SEVERITY_COLOR

### Community 30 - "registry.ts"
Cohesion: 0.47
Nodes (3): Rule, headingMatchesSectionNameRule, INTERNAL_RULES

### Community 31 - "bugs/index.ts"
Cohesion: 0.15
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.18
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 36 - "csv.ts"
Cohesion: 0.43
Nodes (4): buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField()

## Knowledge Gaps
- **248 isolated node(s):** `htmlLangRule`, `NON_LABELABLE_INPUT_TYPES`, `formLabelRule`, `missingAltRule`, `focusOrderRule` (+243 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `run/route.ts`, `requirement.ts`, `finding.ts`, `export/route.ts`, `diffFindings.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `computeReadiness()` connect `export/route.ts` to `findings.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Rule` connect `registry.ts` to `technical-aeo/index.ts`, `run/route.ts`, `settings.ts`, `shopify/index.ts`, `accessibility/index.ts`, `cross-file/index.ts`, `rules.ts`, `bugs/index.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `htmlLangRule`, `NON_LABELABLE_INPUT_TYPES`, `formLabelRule` to the rest of the system?**
  _248 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._