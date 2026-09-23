# Graph Report - Shopify Theme Auditor  (2026-09-23)

## Corpus Check
- 287 files · ~1,580,926 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1398 nodes · 2822 edges · 79 communities (73 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e780bd86`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- [id]/export/google-sheet/route.ts
- rules.ts
- AppShell.tsx
- ThemeDetailTabs.tsx
- settings.ts
- findings.tsx
- pageSpeed.ts
- enhancementSheetFormatting.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- demo-store/page.tsx
- requirement.ts
- extractReadmeVersion.ts
- bugs/index.ts
- PageContainer.tsx
- cross-file/index.ts
- [id]/export/route.ts
- buildTestTheme.ts
- Shopify Theme Auditor
- accessibility/index.ts
- audit-run.ts
- runFilteredRankingCheck.ts
- featureStatus
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- diffFindings.ts
- executeAuditRun.ts
- shopify/index.ts
- readiness.ts
- runRules.ts
- uploadThemeVersion.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- seed-rules.ts
- finding.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- technical-seo/index.ts
- themes/page.tsx
- proxy.ts
- AllChecksList.tsx
- googleapis
- categoryDashboard.tsx
- insights/page.tsx
- getPageLabel
- rule.ts
- themeStoreFeatures.ts
- Button.tsx
- deriveChecksForAuditRun.ts
- enhancementSheetRows.ts
- extractCssStructure.ts
- projectStatus.ts
- xlsx.ts
- accessibility/index.test.ts
- oauth.ts
- mongodb
- ranking/page.tsx
- connect.ts
- templateComposition.ts
- [themeId]/route.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 88 edges
2. `executeAuditRun()` - 19 edges
3. `buildTestTheme()` - 18 edges
4. `isValidObjectId()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `Theme` - 15 edges
8. `runPageSpeedChecksForPresets()` - 14 edges
9. `parseJsonFile()` - 14 edges
10. `getPageLabel()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/rules/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (79 total, 6 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.10
Nodes (27): parseDemoStorePresets(), POST(), GET(), GET(), POST(), GET(), GET(), POST() (+19 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (22): exceljs, htmlparser2, lucide-react, mongoose, next, dependencies, exceljs, htmlparser2 (+14 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.28
Nodes (17): POST(), POST(), getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError, GoogleSheetSpreadsheetNotFoundError (+9 more)

### Community 6 - "rules.ts"
Cohesion: 0.13
Nodes (12): Rule, RuleContext, RuleFinding, Severity, ThemeIndex, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule (+4 more)

### Community 7 - "AppShell.tsx"
Cohesion: 0.21
Nodes (9): AppShell(), isActive(), MobileNav(), NAV_ITEMS, isActive(), Sidebar(), geistMono, geistSans (+1 more)

### Community 9 - "ThemeDetailTabs.tsx"
Cohesion: 0.17
Nodes (10): BreadcrumbItem, Breadcrumbs(), CheckTotals, ThemeDetail, ThemeDetailTabs(), AuditTotals, formatDate(), VersionRow (+2 more)

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.07
Nodes (35): AuditDiagnostics, CATEGORIES, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersions, EngineVersionsNote(), FindingsTable() (+27 more)

### Community 12 - "pageSpeed.ts"
Cohesion: 0.06
Nodes (57): formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow, extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts() (+49 more)

### Community 13 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (16): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys() (+8 more)

### Community 18 - "demo-store/page.tsx"
Cohesion: 0.12
Nodes (17): EmptyState(), ResponsiveTable(), TableColumn, DemoStoreData, DemoStorePage(), DemoStoreRecord, durationMs(), FilteredRankingData (+9 more)

### Community 19 - "requirement.ts"
Cohesion: 0.16
Nodes (14): GET(), RequirementImplementationType, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc, requirementSchema, RULE_STATUSES (+6 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.11
Nodes (24): parseThemeZip(), countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, ExtractedTheme, extractEntries(), extractThemeZip() (+16 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "PageContainer.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "[id]/export/route.ts"
Cohesion: 0.16
Nodes (16): CONTENT_TYPES, Format, FORMATS, GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult, ReadinessResult (+8 more)

### Community 25 - "buildTestTheme.ts"
Cohesion: 0.14
Nodes (16): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), headingMatchesSectionNameRule, INTERNAL_RULES (+8 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 29 - "audit-run.ts"
Cohesion: 0.08
Nodes (29): POST(), localUploadSource(), ThemeSource, AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, demoStorePresetSchema (+21 more)

### Community 30 - "runFilteredRankingCheck.ts"
Cohesion: 0.12
Nodes (20): currentRows(), GET(), parseQuery(), POST(), buildListingUrl(), CatalogFilter, CatalogRankResult, extractCatalogCards() (+12 more)

### Community 31 - "featureStatus"
Cohesion: 0.31
Nodes (6): EnhancementDetection, FeatureMatrixRow, FeatureMatrixTable(), AVAILABLE_FEATURES, AvailableFeature, featureStatus

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.21
Nodes (14): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), extractJsImports(), parseOneFile(), parseThemeDirectory(), ThemeParseResult, ThemeParseTiming (+6 more)

### Community 35 - "diffFindings.ts"
Cohesion: 0.18
Nodes (15): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+7 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (30): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics(), ENHANCEMENT_DETECTORS, EnhancementDetector (+22 more)

### Community 37 - "shopify/index.ts"
Cohesion: 0.16
Nodes (11): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+3 more)

### Community 38 - "readiness.ts"
Cohesion: 0.24
Nodes (8): formatDate(), ReportContent(), computeReadiness(), DEFAULT_READINESS_CONFIG, isUnresolved(), ReadinessConfig, ReadinessFinding, ReadinessStatus

### Community 39 - "runRules.ts"
Cohesion: 0.16
Nodes (16): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules() (+8 more)

### Community 40 - "uploadThemeVersion.ts"
Cohesion: 0.28
Nodes (9): POST(), sha256(), uploadThemeVersion(), UploadVersionResult, versionErrorMessage(), deleteZip(), getBucket(), readZipBuffer() (+1 more)

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 43 - "enhancement-point.ts"
Cohesion: 0.06
Nodes (41): GET(), PATCH(), EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES, EnhancementPoint (+33 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.09
Nodes (23): Card(), CardHeader(), CheckTotals, CoreWebVitalsTable(), formatDate(), formatMs(), healthTone(), isDesktopPerformanceFinding() (+15 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 47 - "finding.ts"
Cohesion: 0.18
Nodes (13): GET(), PATCH(), loadReadinessConfig(), cascadeDeleteFindings(), FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_SEVERITIES, FINDING_STATUSES (+5 more)

### Community 48 - "sheetRows.ts"
Cohesion: 0.13
Nodes (21): DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX (+13 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "sheetsFormatting.ts"
Cohesion: 0.09
Nodes (20): SheetFormattingRequest, buildSheetFormattingRequests(), CATEGORY_TAB_COLORS, COLUMN_WIDTHS, HEADER_BACKGROUND, HEADER_TEXT, RESOLVED_COLUMN_INDEX, RGB (+12 more)

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "diff.tsx"
Cohesion: 0.12
Nodes (15): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+7 more)

### Community 53 - "technical-seo/index.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

### Community 54 - "themes/page.tsx"
Cohesion: 0.16
Nodes (19): CheckTotals, formatDate(), healthPercent(), healthTone(), isStale(), isVersionMismatch(), PrioritizedThemeRow, ROW_TONE_CLASS (+11 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "AllChecksList.tsx"
Cohesion: 0.27
Nodes (7): SeverityBadge(), CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList(), matchesSearch(), STATUS_FILTERS

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.08
Nodes (20): Tab, TabbedPageClient(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES (+12 more)

### Community 60 - "getPageLabel"
Cohesion: 0.21
Nodes (9): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), COLUMNS (+1 more)

### Community 61 - "rule.ts"
Cohesion: 0.27
Nodes (7): GET(), GET(), FINDING_CATEGORIES, Rule, RULE_CRITICALITIES, RuleDoc, ruleSchema

### Community 62 - "themeStoreFeatures.ts"
Cohesion: 0.14
Nodes (18): checkPendingThemeStoreListings(), runDemoStoreCheck(), deriveThemeStoreSlug(), extractDemoStoreIframeUrl(), extractFeatureLabels(), extractLatestRelease(), extractPresets(), extractReviewSummary() (+10 more)

### Community 63 - "Button.tsx"
Cohesion: 0.13
Nodes (13): DemoStorePreset, PresetLinksEditor(), Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, Modal() (+5 more)

### Community 64 - "deriveChecksForAuditRun.ts"
Cohesion: 0.28
Nodes (6): baseArgs, CategoryChecks, CheckEvidence, CheckItem, CheckStatus, severityBucket()

### Community 65 - "enhancementSheetRows.ts"
Cohesion: 0.18
Nodes (12): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetEnhancementPoint (+4 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "xlsx.ts"
Cohesion: 0.38
Nodes (5): addFindingsSheet(), buildReportXlsx(), FINDING_COLUMNS, XlsxFinding, XlsxSummary

### Community 72 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 78 - "ranking/page.tsx"
Cohesion: 0.31
Nodes (6): ChartSeries, LineChart(), nearestIndex(), PAD, SERIES_VARS, HistoryData

### Community 79 - "connect.ts"
Cohesion: 0.22
Nodes (13): GET(), GET(), PATCH(), GET(), GET(), GET(), invalidIdResponse(), isValidObjectId() (+5 more)

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 82 - "[themeId]/route.ts"
Cohesion: 0.16
Nodes (22): GET(), POST(), GET(), PATCH(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, compareVersions() (+14 more)

## Knowledge Gaps
- **470 isolated node(s):** `ThemeVersionResult`, `VERSION_VALUE_RE`, `VERSION_LINE_RE`, `SETTINGS_SCHEMA_RELATIVE_PATH`, `RankingCheckResult` (+465 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `diffFindings.ts`, `[id]/export/google-sheet/route.ts`, `runRules.ts`, `oauth.ts`, `uploadThemeVersion.ts`, `enhancement-point.ts`, `seed-rules.ts`, `connect.ts`, `finding.ts`, `[themeId]/route.ts`, `requirement.ts`, `audit-run.ts`, `[id]/export/route.ts`, `themeStoreFeatures.ts`, `rule.ts`, `runFilteredRankingCheck.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `executeAuditRun.ts`, `ThemeDetailTabs.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `[themeId]/route.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `FINDING_CATEGORIES` connect `rule.ts` to `deriveChecksForAuditRun.ts`, `rules.ts`, `finding.ts`, `sheetRows.ts`, `requirement.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ThemeVersionResult`, `VERSION_VALUE_RE`, `VERSION_LINE_RE` to the rest of the system?**
  _470 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connectToDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._