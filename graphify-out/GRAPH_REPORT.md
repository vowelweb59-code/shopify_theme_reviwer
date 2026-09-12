# Graph Report - Shopify Theme Auditor  (2026-09-12)

## Corpus Check
- 175 files · ~1,522,956 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 918 nodes · 1746 edges · 54 communities (48 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5783ed6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- isValidObjectId
- devDependencies
- dependencies
- compilerOptions
- types.ts
- [id]/export/google-sheet/route.ts
- finding.ts
- ProjectStatusWidget.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- settings/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- connectToDatabase
- rules.ts
- bugs/index.ts
- accessibility/index.ts
- cross-file/index.ts
- registry.ts
- [id]/export/route.ts
- Shopify Theme Auditor
- getPageLabel
- readiness/route.ts
- seed-rules.ts
- themeIndex.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- run/route.ts
- extractCssStructure.ts
- headingChecks.ts
- liquidJson.ts
- zip.ts
- scripts
- maintenance/page.tsx
- enhancement-point.ts
- accessibility/index.test.ts
- package.json
- diffFindings.ts
- @types/node
- sheetRows.ts
- aggregate-release-notes.mjs
- templateComposition.ts
- harvest-release-notes.mjs
- pdf.ts
- xlsx.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 51 edges
2. `isValidObjectId()` - 18 edges
3. `invalidIdResponse()` - 17 edges
4. `compilerOptions` - 16 edges
5. `POST()` - 14 edges
6. `parseJsonFile()` - 14 edges
7. `getPageLabel()` - 14 edges
8. `GET()` - 13 edges
9. `scripts` - 12 edges
10. `Rule` - 12 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/route.ts → lib/db/connect.ts
- `POST()` --calls--> `runAuditRules()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/index.ts
- `POST()` --calls--> `runLiveChecks()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/liveCheck.ts

## Import Cycles
- None detected.

## Communities (54 total, 6 thin omitted)

### Community 0 - "isValidObjectId"
Cohesion: 0.36
Nodes (8): GET(), GET(), PATCH(), GET(), invalidIdResponse(), isValidObjectId(), buildDiffCsv(), Finding

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (21): exceljs, googleapis, htmlparser2, mongoose, next, dependencies, exceljs, googleapis (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, isLiquidExpression(), StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton (+16 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.06
Nodes (51): POST(), SHEET_OPTIONS, POST(), buildEnhancementSheetTabs(), buildRow(), ENHANCEMENT_TAB_COLUMNS, SheetEnhancementPoint, SOURCE_LABELS (+43 more)

### Community 6 - "finding.ts"
Cohesion: 0.09
Nodes (23): GET(), AUDIT_RUN_STATUSES, AuditRun, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema (+15 more)

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
Cohesion: 0.05
Nodes (54): AuditRunResult, CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), ATTRIBUTION_LABEL, CategoryDiffSummary (+46 more)

### Community 13 - "settings/page.tsx"
Cohesion: 0.33
Nodes (3): GoogleStatus, ReadinessConfig, SEVERITIES

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 19 - "connectToDatabase"
Cohesion: 0.11
Nodes (25): CheckStatus, GET(), GET(), GET(), GET(), connectToDatabase(), globalForMongoose, MongooseCache (+17 more)

### Community 20 - "rules.ts"
Cohesion: 0.14
Nodes (13): FindingCategory, RuleContext, Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule (+5 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (8): RuleFinding, BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "accessibility/index.ts"
Cohesion: 0.08
Nodes (34): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+26 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "registry.ts"
Cohesion: 0.17
Nodes (15): loadEnabledRules(), runAuditRules(), Rule, dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary (+7 more)

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.19
Nodes (15): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+7 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.17
Nodes (11): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Native capabilities (no app required), Per-theme detection, Requirements knowledge base (+3 more)

### Community 28 - "getPageLabel"
Cohesion: 0.19
Nodes (10): DiffFinding, BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField() (+2 more)

### Community 29 - "readiness/route.ts"
Cohesion: 0.27
Nodes (9): GET(), PATCH(), DEFAULT_READINESS_CONFIG, ReadinessConfig, loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel (+1 more)

### Community 30 - "seed-rules.ts"
Cohesion: 0.36
Nodes (5): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), main()

### Community 31 - "themeIndex.ts"
Cohesion: 0.29
Nodes (10): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, buildTestTheme() (+2 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.18
Nodes (17): extractCssStructure(), extractHtmlStructure(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags(), emptyParsedFile() (+9 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "run/route.ts"
Cohesion: 0.09
Nodes (25): captureRuleVersionSnapshot(), detectEnhancementsForRun(), extractSourceSnippet(), loadThemeFindingHistory(), POST(), toFindingDocs(), detectEnhancementPoints(), EnhancementDetectionResult (+17 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.29
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 38 - "headingChecks.ts"
Cohesion: 0.16
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 42 - "maintenance/page.tsx"
Cohesion: 0.33
Nodes (3): MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL

### Community 43 - "enhancement-point.ts"
Cohesion: 0.06
Nodes (41): GET(), PATCH(), EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES, EnhancementPoint (+33 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "diffFindings.ts"
Cohesion: 0.16
Nodes (17): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+9 more)

### Community 48 - "sheetRows.ts"
Cohesion: 0.13
Nodes (19): mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX, FINDING_COLUMN_INDEX (+11 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "pdf.ts"
Cohesion: 0.32
Nodes (6): buildReportHtml(), escapeHtml(), PdfFindingRow, PdfSummary, renderReportPdf(), SEVERITY_COLOR

### Community 53 - "xlsx.ts"
Cohesion: 0.38
Nodes (5): addFindingsSheet(), buildReportXlsx(), FINDING_COLUMNS, XlsxFinding, XlsxSummary

## Knowledge Gaps
- **350 isolated node(s):** `Stack`, `Setup`, `Database`, `Code graph`, `Requirements knowledge base` (+345 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `isValidObjectId`, `oauth.ts`, `run/route.ts`, `[id]/export/google-sheet/route.ts`, `finding.ts`, `enhancement-point.ts`, `diffFindings.ts`, `[id]/export/route.ts`, `readiness/route.ts`, `seed-rules.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`, `@types/node`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `POST()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`POST()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Stack`, `Setup`, `Database` to the rest of the system?**
  _350 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._