# Graph Report - Shopify Theme Auditor  (2026-09-16)

## Corpus Check
- 183 files · ~1,533,563 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 990 nodes · 1900 edges · 59 communities (54 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2dd7d9e2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
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
- requirement.ts
- registry.ts
- bugs/index.ts
- liveCheck.ts
- cross-file/index.ts
- pageSpeed.ts
- [id]/export/route.ts
- Shopify Theme Auditor
- getPageLabel
- readiness/route.ts
- seed-rules.ts
- runRules.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- run/route.ts
- extractCssStructure.ts
- audit/page.tsx
- liquidJson.ts
- zip.ts
- scripts
- maintenance/page.tsx
- enhancement-point.ts
- rules.ts
- package.json
- audit-settings.ts
- @types/node
- sheetRows.ts
- aggregate-release-notes.mjs
- templateComposition.ts
- harvest-release-notes.mjs
- diff.tsx
- shopify/index.ts
- themeIndex.ts
- proxy.ts
- [id]/page.tsx
- categoryDashboard.tsx
- enhancementReport.tsx

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 53 edges
2. `isValidObjectId()` - 18 edges
3. `invalidIdResponse()` - 17 edges
4. `POST()` - 16 edges
5. `compilerOptions` - 16 edges
6. `POST()` - 14 edges
7. `parseJsonFile()` - 14 edges
8. `getPageLabel()` - 14 edges
9. `Rule` - 13 edges
10. `GET()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/rules/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (59 total, 5 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.28
Nodes (13): GET(), GET(), PATCH(), GET(), GET(), GET(), invalidIdResponse(), isValidObjectId() (+5 more)

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
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.08
Nodes (47): POST(), POST(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab() (+39 more)

### Community 6 - "finding.ts"
Cohesion: 0.10
Nodes (23): GET(), AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), demoStorePresetSchema, diagnosticsSchema (+15 more)

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
Cohesion: 0.10
Nodes (20): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+12 more)

### Community 13 - "settings/page.tsx"
Cohesion: 0.33
Nodes (3): GoogleStatus, ReadinessConfig, SEVERITIES

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (16): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys() (+8 more)

### Community 19 - "requirement.ts"
Cohesion: 0.12
Nodes (20): GET(), GET(), GET(), FINDING_CATEGORIES, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc (+12 more)

### Community 20 - "registry.ts"
Cohesion: 0.16
Nodes (12): findSkippedHeadingLevels(), Rule, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, imageDimensionsRule (+4 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.17
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "liveCheck.ts"
Cohesion: 0.07
Nodes (39): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), comparePresets(), contrastFindings(), ContrastSample (+31 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (22): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, brokenAriaReferenceRule, composedArticleSchemaRule (+14 more)

### Community 24 - "pageSpeed.ts"
Cohesion: 0.11
Nodes (26): formatDate(), formatScore(), PageSpeedPage(), ThemePageSpeedRow, PresetLink, PresetLiveCheckError, collectPlaywrightMetrics(), extractCoreMetrics() (+18 more)

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.17
Nodes (15): CONTENT_TYPES, Format, FORMATS, GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult, computeReadiness() (+7 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "getPageLabel"
Cohesion: 0.10
Nodes (20): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildDiffCsv() (+12 more)

### Community 29 - "readiness/route.ts"
Cohesion: 0.27
Nodes (9): GET(), PATCH(), DEFAULT_READINESS_CONFIG, ReadinessConfig, loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel (+1 more)

### Community 30 - "seed-rules.ts"
Cohesion: 0.36
Nodes (5): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), main()

### Community 31 - "runRules.ts"
Cohesion: 0.14
Nodes (17): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding (+9 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.18
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.15
Nodes (20): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), extractJsImports(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseResult (+12 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "run/route.ts"
Cohesion: 0.09
Nodes (27): captureRuleVersionSnapshot(), detectEnhancementsForRun(), extractSourceSnippet(), loadThemeFindingHistory(), parseDemoStorePresets(), POST(), toFindingDocs(), detectEnhancementPoints() (+19 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 38 - "audit/page.tsx"
Cohesion: 0.22
Nodes (7): AuditRunResult, DemoStorePreset, PresetLiveCheckError, AuditDiagnostics, DiagnosticsNote(), FindingSummary, SummaryBar()

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
Cohesion: 0.07
Nodes (36): GET(), PATCH(), EnhancementPoint, Example, SOURCE_LABELS, STATUS_LABELS, STATUSES, TIER_STYLES (+28 more)

### Community 44 - "rules.ts"
Cohesion: 0.15
Nodes (6): RuleContext, RuleFinding, ACCESSIBILITY_RULES, CROSS_FILE_RULES, BASE_LAYOUT, buildTestTheme()

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 48 - "sheetRows.ts"
Cohesion: 0.05
Nodes (48): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffFinding, DiffStatus (+40 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "diff.tsx"
Cohesion: 0.12
Nodes (16): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+8 more)

### Community 53 - "shopify/index.ts"
Cohesion: 0.15
Nodes (11): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+3 more)

### Community 54 - "themeIndex.ts"
Cohesion: 0.40
Nodes (7): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "[id]/page.tsx"
Cohesion: 0.17
Nodes (12): CoverageSummary, CoverageSummaryBar(), EngineVersionsNote(), FindingStatus, ReadinessPanel(), ReadinessSummary, RequirementInfo, TimingNote() (+4 more)

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

## Knowledge Gaps
- **370 isolated node(s):** `nextConfig`, `config`, `EnhancementReportPoint`, `FindingDoc`, `SchemaNameContext` (+365 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `oauth.ts`, `run/route.ts`, `[id]/export/google-sheet/route.ts`, `finding.ts`, `enhancement-point.ts`, `sheetRows.ts`, `requirement.ts`, `[id]/export/route.ts`, `readiness/route.ts`, `seed-rules.ts`, `runRules.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`, `@types/node`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `POST()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`POST()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `nextConfig`, `config`, `EnhancementReportPoint` to the rest of the system?**
  _370 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._