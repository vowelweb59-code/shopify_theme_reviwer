# Graph Report - Shopify Theme Auditor  (2026-08-14)

## Corpus Check
- 103 files · ~1,463,923 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 556 nodes · 935 edges · 40 communities (36 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba1628c1`
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
- [id]/page.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- finding.ts
- export/route.ts
- shopify/index.ts
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
- rules.ts
- extractLiquidStructure.ts
- buildLineIndex
- zip.ts
- extractCssStructure.ts
- liquidJson.ts
- validateThemeStructure.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 23 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `buildLineIndex()` - 11 edges
6. `scripts` - 9 edges
7. `POST()` - 8 edges
8. `runLiveChecks()` - 8 edges
9. `buildTestTheme()` - 8 edges
10. `extractLiquidStructure()` - 8 edges

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

## Communities (40 total, 4 thin omitted)

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
Cohesion: 0.13
Nodes (23): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+15 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.26
Nodes (10): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), emptyMetaTags(), emptyParsedFile(), FileType, DiscoveredFile (+2 more)

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

### Community 11 - "[id]/page.tsx"
Cohesion: 0.13
Nodes (22): AuditRunResult, DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult, STATUS_LABEL, STATUS_STYLES (+14 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.25
Nodes (12): extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys(), isLocaleFilePath(), isSectionGroupPath(), isSettingsSchemaPath(), isTemplateJsonPath() (+4 more)

### Community 19 - "finding.ts"
Cohesion: 0.18
Nodes (11): FINDING_CATEGORIES, FINDING_LAYERS, FINDING_SEVERITIES, FindingDoc, findingSchema, RuleDoc, ruleSchema, cascadeDeleteRuns() (+3 more)

### Community 20 - "export/route.ts"
Cohesion: 0.20
Nodes (11): GET(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildReportHtml(), escapeHtml(), PdfFindingRow (+3 more)

### Community 21 - "shopify/index.ts"
Cohesion: 0.17
Nodes (10): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+2 more)

### Community 22 - "liveCheck.ts"
Cohesion: 0.09
Nodes (37): POST(), toFindingDocs(), contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), AuditDiagnostics, computeAuditDiagnostics() (+29 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (42): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets(), ComposedTemplate (+34 more)

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
Cohesion: 0.14
Nodes (10): BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule, focusOrderRule, formLabelRule, htmlLangRule, missingAltRule, NON_LABELABLE_INPUT_TYPES (+2 more)

### Community 30 - "registry.ts"
Cohesion: 0.21
Nodes (9): findSkippedHeadingLevels(), Rule, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, multipleH1Rule, renderBlockingScriptRule, skippedHeadingSeoRule (+1 more)

### Community 31 - "bugs/index.ts"
Cohesion: 0.18
Nodes (6): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.18
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "rules.ts"
Cohesion: 0.28
Nodes (3): RuleContext, RuleFinding, ACCESSIBILITY_RULES

### Community 34 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (21): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+13 more)

### Community 35 - "buildLineIndex"
Cohesion: 0.31
Nodes (6): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), ParsedJsImport

### Community 36 - "zip.ts"
Cohesion: 0.24
Nodes (9): ExtractedTheme, extractEntries(), extractThemeZip(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath() (+1 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 38 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 39 - "validateThemeStructure.ts"
Cohesion: 0.50
Nodes (4): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES

## Knowledge Gaps
- **222 isolated node(s):** `PhaseEntry`, `STATUS_WEIGHT`, `MongooseCache`, `SchemaNameContext`, `SchemaSettingsContext` (+217 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `diffFindings.ts`, `export/route.ts`, `liveCheck.ts`, `seed-requirements.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `Rule` connect `registry.ts` to `technical-aeo/index.ts`, `rules.ts`, `settings.ts`, `shopify/index.ts`, `liveCheck.ts`, `cross-file/index.ts`, `accessibility/index.ts`, `bugs/index.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `parseJsonFile()` connect `parseJsonFile.ts` to `buildLineIndex`, `theme-parser/index.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `PhaseEntry`, `STATUS_WEIGHT`, `MongooseCache` to the rest of the system?**
  _222 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._