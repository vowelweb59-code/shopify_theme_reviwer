# Graph Report - Shopify Theme Auditor  (2026-08-17)

## Corpus Check
- 116 files · ~1,470,699 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 623 nodes · 1081 edges · 38 communities (33 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8df05c1f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- theme-parser/index.ts
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
- parseJsonFile.ts
- finding.ts
- export/route.ts
- rules.ts
- liveCheck.ts
- cross-file/index.ts
- extractLiquidStructure.ts
- reports/[id]/route.ts
- Shopify Theme Auditor
- diffFindings.ts
- accessibility/index.ts
- registry.ts
- bugs/index.ts
- technical-aeo/index.ts
- accessibility/index.test.ts
- extractCssStructure.ts
- buildLineIndex
- csv.ts
- liquidJson.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 25 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `buildLineIndex()` - 11 edges
6. `buildTestTheme()` - 11 edges
7. `GET()` - 10 edges
8. `computeReadiness()` - 9 edges
9. `scripts` - 9 edges
10. `POST()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/rules/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-rules.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (38 total, 5 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.23
Nodes (10): GET(), GET(), PATCH(), GET(), connectToDatabase(), globalForMongoose, MongooseCache, AuditRun (+2 more)

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
Cohesion: 0.13
Nodes (23): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+15 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.08
Nodes (38): extractSourceSnippet(), POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), loadEnabledRules(), runAuditRules(), FindingCategory (+30 more)

### Community 6 - "requirement.ts"
Cohesion: 0.11
Nodes (20): GET(), GET(), FINDING_CATEGORIES, FINDING_SEVERITIES, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc (+12 more)

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

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.28
Nodes (11): extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys(), isLocaleFilePath(), isSectionGroupPath(), isSettingsSchemaPath(), isTemplateJsonPath() (+3 more)

### Community 19 - "finding.ts"
Cohesion: 0.11
Nodes (19): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema, liveCheckErrorSchema (+11 more)

### Community 20 - "export/route.ts"
Cohesion: 0.15
Nodes (15): CONTENT_TYPES, Format, FORMATS, GET(), buildReportHtml(), escapeHtml(), PdfFindingRow, PdfSummary (+7 more)

### Community 21 - "rules.ts"
Cohesion: 0.15
Nodes (12): RuleContext, Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule (+4 more)

### Community 22 - "liveCheck.ts"
Cohesion: 0.16
Nodes (21): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+13 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (42): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets(), ComposedTemplate (+34 more)

### Community 24 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 25 - "reports/[id]/route.ts"
Cohesion: 0.19
Nodes (12): GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult, computeReadiness(), isUnresolved(), READINESS_COVERAGE_THRESHOLD_PERCENT, ReadinessFinding (+4 more)

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

### Community 34 - "extractCssStructure.ts"
Cohesion: 0.19
Nodes (11): CSS_NAMED_COLORS, looksLikeColorValue(), COLOR_PROPERTIES, extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), emptyMetaTags() (+3 more)

### Community 35 - "buildLineIndex"
Cohesion: 0.31
Nodes (6): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), ParsedJsImport

### Community 36 - "csv.ts"
Cohesion: 0.43
Nodes (4): buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField()

### Community 37 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

## Knowledge Gaps
- **246 isolated node(s):** `CATEGORY_ORDER`, `ReadinessStatus`, `SEVERITY_STYLES`, `STATUS_STYLES`, `READINESS_STYLES` (+241 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `theme-parser/index.ts`, `requirement.ts`, `export/route.ts`, `reports/[id]/route.ts`, `diffFindings.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `computeReadiness()` connect `reports/[id]/route.ts` to `findings.tsx`, `export/route.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Rule` connect `registry.ts` to `technical-aeo/index.ts`, `theme-parser/index.ts`, `settings.ts`, `rules.ts`, `cross-file/index.ts`, `accessibility/index.ts`, `bugs/index.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `CATEGORY_ORDER`, `ReadinessStatus`, `SEVERITY_STYLES` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._