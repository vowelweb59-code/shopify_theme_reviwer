# Graph Report - Shopify Theme Auditor  (2026-09-18)

## Corpus Check
- 243 files · ~1,564,533 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1263 nodes · 2525 edges · 75 communities (69 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7638a0ce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- diffFindings.ts
- devDependencies
- dependencies
- compilerOptions
- types.ts
- [id]/export/google-sheet/route.ts
- registry.ts
- AppShell.tsx
- ThemeDetailTabs.tsx
- settings.ts
- findings.tsx
- liveCheck.ts
- getPageLabel
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- finding.ts
- deriveChecksForAuditRun.ts
- extractReadmeVersion.ts
- bugs/index.ts
- connectToDatabase
- cross-file/index.ts
- reports/[id]/route.ts
- buildTestTheme.ts
- Shopify Theme Auditor
- accessibility/index.ts
- [themeId]/route.ts
- uploadThemeVersion.ts
- runRules.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- seed-rules.ts
- isValidObjectId
- liquidJson.ts
- enhancementSheetFormatting.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- enhancementSheetRows.ts
- AllChecksList.tsx
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- [id]/export/route.ts
- themes/page.tsx
- proxy.ts
- ReportContent.tsx
- googleapis
- categoryDashboard.tsx
- insights/page.tsx
- audit-run.ts
- PageContainer.tsx
- computeScoreboard.ts
- Button.tsx
- enhancementReport.tsx
- rules.ts
- extractCssStructure.ts
- projectStatus.ts
- buildLineIndex
- mongoose
- AddThemeModal.tsx
- @types/yauzl
- templateComposition.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 69 edges
2. `executeAuditRun()` - 19 edges
3. `isValidObjectId()` - 18 edges
4. `buildTestTheme()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `runPageSpeedChecksForPresets()` - 14 edges
8. `parseJsonFile()` - 14 edges
9. `POST()` - 14 edges
10. `getPageLabel()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `featureStatus`  [EXTRACTED]
  app/api/available-features/route.ts → lib/audit/availableFeatures.ts
- `GET()` --calls--> `invalidIdResponse()`  [EXTRACTED]
  app/api/reports/[id]/diff/route.ts → lib/api/validation.ts

## Import Cycles
- None detected.

## Communities (75 total, 6 thin omitted)

### Community 0 - "diffFindings.ts"
Cohesion: 0.15
Nodes (19): GET(), GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus (+11 more)

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (21): exceljs, htmlparser2, lucide-react, mongodb, next, dependencies, exceljs, htmlparser2 (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.13
Nodes (23): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+15 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.30
Nodes (16): POST(), POST(), getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError, GoogleSheetSpreadsheetNotFoundError (+8 more)

### Community 6 - "registry.ts"
Cohesion: 0.16
Nodes (10): findMultipleH1(), Rule, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, imageDimensionsRule, multipleH1Rule, renderBlockingScriptRule (+2 more)

### Community 7 - "AppShell.tsx"
Cohesion: 0.21
Nodes (9): AppShell(), isActive(), MobileNav(), NAV_ITEMS, isActive(), Sidebar(), geistMono, geistSans (+1 more)

### Community 9 - "ThemeDetailTabs.tsx"
Cohesion: 0.28
Nodes (5): BreadcrumbItem, Breadcrumbs(), CheckTotals, ThemeDetail, ThemeDetailTabs()

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.09
Nodes (21): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+13 more)

### Community 12 - "liveCheck.ts"
Cohesion: 0.05
Nodes (67): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), collectFocusIndicatorSamples(), comparePresets(), contrastFindings() (+59 more)

### Community 13 - "getPageLabel"
Cohesion: 0.16
Nodes (12): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildReportHtml() (+4 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.28
Nodes (11): extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys(), isLocaleFilePath(), isSectionGroupPath(), isSettingsSchemaPath(), isTemplateJsonPath() (+3 more)

### Community 18 - "finding.ts"
Cohesion: 0.16
Nodes (15): GET(), PATCH(), DEFAULT_READINESS_CONFIG, ReadinessConfig, loadReadinessConfig(), cascadeDeleteFindings(), FINDING_HISTORICAL_STATES, FINDING_LAYERS (+7 more)

### Community 19 - "deriveChecksForAuditRun.ts"
Cohesion: 0.13
Nodes (20): RequirementImplementationType, CheckEvidence, CheckStatus, FINDING_CATEGORIES, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc (+12 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.11
Nodes (22): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, ExtractedTheme, extractEntries(), extractThemeZip(), MAX_FILE_COUNT (+14 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "connectToDatabase"
Cohesion: 0.15
Nodes (18): parseDemoStorePresets(), POST(), GET(), CheckStatus, GET(), GET(), GET(), GET() (+10 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (22): ComposedHeading, ComposedHeadingIssue, findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, brokenAriaReferenceRule, composedArticleSchemaRule (+14 more)

### Community 24 - "reports/[id]/route.ts"
Cohesion: 0.27
Nodes (8): GET(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, computeReadiness(), isUnresolved(), ReadinessFinding, ReadinessStatus

### Community 25 - "buildTestTheme.ts"
Cohesion: 0.14
Nodes (17): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, headingMatchesSectionNameRule (+9 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.07
Nodes (17): ACCESSIBILITY_RULES, ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule, COLOR_LIKE_PROPS, colorContrastRule, cssOrderRule (+9 more)

### Community 29 - "[themeId]/route.ts"
Cohesion: 0.22
Nodes (14): GET(), GET(), POST(), GET(), PATCH(), compareVersions(), ParsedVersion, parseVersionForSort() (+6 more)

### Community 30 - "uploadThemeVersion.ts"
Cohesion: 0.30
Nodes (8): POST(), sha256(), uploadThemeVersion(), UploadVersionResult, versionErrorMessage(), deleteZip(), getBucket(), storeZipBuffer()

### Community 31 - "runRules.ts"
Cohesion: 0.19
Nodes (14): loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary (+6 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.21
Nodes (14): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseResult, ThemeParseTiming (+6 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (30): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics(), ENHANCEMENT_DETECTORS, EnhancementDetector (+22 more)

### Community 37 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 38 - "isValidObjectId"
Cohesion: 0.44
Nodes (6): GET(), GET(), PATCH(), invalidIdResponse(), isValidObjectId(), Finding

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 43 - "enhancement-point.ts"
Cohesion: 0.07
Nodes (37): GET(), PATCH(), EnhancementPoint, Example, FutureUpdatesContent(), SOURCE_LABELS, STATUS_LABELS, STATUSES (+29 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.15
Nodes (14): Card(), CardHeader(), CheckTotals, formatDate(), healthTone(), OverviewPanel(), Props, RunAuditForm() (+6 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "enhancementSheetRows.ts"
Cohesion: 0.16
Nodes (13): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetEnhancementPoint (+5 more)

### Community 47 - "AllChecksList.tsx"
Cohesion: 0.27
Nodes (7): SeverityBadge(), CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList(), matchesSearch(), STATUS_FILTERS

### Community 48 - "sheetRows.ts"
Cohesion: 0.13
Nodes (21): DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX (+13 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "sheetsFormatting.ts"
Cohesion: 0.09
Nodes (19): buildSheetFormattingRequests(), CATEGORY_TAB_COLORS, COLUMN_WIDTHS, HEADER_BACKGROUND, HEADER_TEXT, RESOLVED_COLUMN_INDEX, RGB, SEVERITY_COLORS (+11 more)

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "diff.tsx"
Cohesion: 0.12
Nodes (15): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+7 more)

### Community 53 - "[id]/export/route.ts"
Cohesion: 0.16
Nodes (16): CONTENT_TYPES, Format, FORMATS, GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult, ReadinessResult (+8 more)

### Community 54 - "themes/page.tsx"
Cohesion: 0.15
Nodes (17): EmptyState(), ResponsiveTable(), TableColumn, Dashboard(), DashboardData, formatDate(), healthTone(), CheckTotals (+9 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "ReportContent.tsx"
Cohesion: 0.12
Nodes (16): AuditDiagnostics, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersionsNote(), FindingStatus, FindingSummary, ReadinessPanel() (+8 more)

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.07
Nodes (25): Tab, TabbedPageClient(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES (+17 more)

### Community 60 - "audit-run.ts"
Cohesion: 0.09
Nodes (27): POST(), localUploadSource(), ThemeSource, readZipBuffer(), AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema (+19 more)

### Community 61 - "PageContainer.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

### Community 62 - "computeScoreboard.ts"
Cohesion: 0.19
Nodes (12): AVAILABLE_FEATURES, AvailableFeature, featureStatus, averageDefined(), categoryScore(), computeScoreboard(), featuresScoreCard(), opportunitiesScoreCard() (+4 more)

### Community 63 - "Button.tsx"
Cohesion: 0.20
Nodes (10): Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, AuditTotals, formatDate(), VersionRow (+2 more)

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "rules.ts"
Cohesion: 0.09
Nodes (20): RuleContext, RuleFinding, Severity, CROSS_FILE_RULES, BASE_LAYOUT, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES (+12 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.29
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "buildLineIndex"
Cohesion: 0.31
Nodes (6): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), ParsedJsImport

### Community 72 - "AddThemeModal.tsx"
Cohesion: 0.36
Nodes (4): DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal()

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

## Knowledge Gaps
- **435 isolated node(s):** `LiveCheckResult`, `MultiPresetLiveCheckResult`, `LOW_MEMORY_CHROMIUM_ARGS`, `MEDIUM_VIEWPORT`, `ContrastSample` (+430 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `googleapis`, `liveCheck.ts`, `package.json`, `mongoose`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `connectToDatabase()` connect `connectToDatabase` to `diffFindings.ts`, `oauth.ts`, `[id]/export/google-sheet/route.ts`, `isValidObjectId`, `seed-rules.ts`, `enhancement-point.ts`, `finding.ts`, `deriveChecksForAuditRun.ts`, `[id]/export/route.ts`, `reports/[id]/route.ts`, `audit-run.ts`, `[themeId]/route.ts`, `uploadThemeVersion.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `PageContainer()` connect `PageContainer.tsx` to `ThemeDetailTabs.tsx`, `insights/page.tsx`, `themes/page.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LiveCheckResult`, `MultiPresetLiveCheckResult`, `LOW_MEMORY_CHROMIUM_ARGS` to the rest of the system?**
  _435 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `diffFindings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._