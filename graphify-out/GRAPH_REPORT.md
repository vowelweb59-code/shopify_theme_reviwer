# Graph Report - Shopify Theme Auditor  (2026-09-23)

## Corpus Check
- 286 files · ~1,579,541 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1391 nodes · 2803 edges · 88 communities (83 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7022d8c9`
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
- finding.ts
- extractReadmeVersion.ts
- bugs/index.ts
- available-features/page.tsx
- cross-file/index.ts
- getPageLabel
- internal/index.ts
- Shopify Theme Auditor
- accessibility/index.ts
- audit-run.ts
- runFilteredRankingCheck.ts
- available-features/route.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- uploadThemeVersion.ts
- executeAuditRun.ts
- shopify/index.ts
- ReportContent.tsx
- runRules.ts
- audit/route.ts
- scripts
- FutureUpdatesContent.tsx
- OverviewPanel.tsx
- package.json
- seed-rules.ts
- enhancement-point.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- seed-native-capabilities.ts
- themes/page.tsx
- proxy.ts
- AllChecksList.tsx
- googleapis
- categoryDashboard.tsx
- settings/page.tsx
- themes/route.ts
- zip.ts
- themeStoreFeatures.ts
- Button.tsx
- enhancementReport.tsx
- enhancementSheetRows.ts
- extractCssStructure.ts
- projectStatus.ts
- presets.ts
- buildTestTheme.ts
- oauth.ts
- AddThemeModal.tsx
- mongodb
- [id]/export/route.ts
- insights/page.tsx
- ranking/page.tsx
- isValidObjectId
- templateComposition.ts
- theme.ts
- [themeId]/route.ts
- PageContainer.tsx
- RequirementsReview.tsx
- ScoreboardGrid.tsx
- VersionsSection.tsx
- readiness/route.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 86 edges
2. `executeAuditRun()` - 19 edges
3. `buildTestTheme()` - 18 edges
4. `isValidObjectId()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `runPageSpeedChecksForPresets()` - 14 edges
8. `parseJsonFile()` - 14 edges
9. `getPageLabel()` - 14 edges
10. `POST()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (88 total, 5 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.11
Nodes (24): GET(), GET(), POST(), GET(), GET(), register(), connectToDatabase(), globalForMongoose (+16 more)

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
Cohesion: 0.24
Nodes (19): POST(), POST(), SheetEnhancementPoint, SheetFutureUpdatesPoint, getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList() (+11 more)

### Community 6 - "rules.ts"
Cohesion: 0.11
Nodes (14): Rule, RuleContext, Severity, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, CHECKS, PresenceCheck (+6 more)

### Community 7 - "AppShell.tsx"
Cohesion: 0.21
Nodes (9): AppShell(), isActive(), MobileNav(), NAV_ITEMS, isActive(), Sidebar(), geistMono, geistSans (+1 more)

### Community 9 - "ThemeDetailTabs.tsx"
Cohesion: 0.28
Nodes (5): Tab, TabbedPageClient(), CheckTotals, ThemeDetail, ThemeDetailTabs()

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.09
Nodes (21): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+13 more)

### Community 12 - "pageSpeed.ts"
Cohesion: 0.06
Nodes (53): extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts(), isAbortError(), PageFacts, comparePresets(), PresetFacts (+45 more)

### Community 13 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 18 - "demo-store/page.tsx"
Cohesion: 0.12
Nodes (17): EmptyState(), ResponsiveTable(), TableColumn, DemoStoreData, DemoStorePage(), DemoStoreRecord, durationMs(), FilteredRankingData (+9 more)

### Community 19 - "finding.ts"
Cohesion: 0.10
Nodes (26): GET(), GET(), RequirementImplementationType, GET(), FINDING_CATEGORIES, FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_STATUSES (+18 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.18
Nodes (13): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, extractThemeVersionFromZip(), extractVersionFromReadmeText(), extractVersionFromSettingsSchema(), findReadmeFile() (+5 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "available-features/page.tsx"
Cohesion: 0.29
Nodes (6): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures

### Community 23 - "cross-file/index.ts"
Cohesion: 0.07
Nodes (23): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, brokenAriaReferenceRule (+15 more)

### Community 24 - "getPageLabel"
Cohesion: 0.10
Nodes (20): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildDiffCsv() (+12 more)

### Community 25 - "internal/index.ts"
Cohesion: 0.15
Nodes (14): basenameNoExt(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, headingMatchesSectionNameRule, MERCHANDISING_AXES (+6 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 29 - "audit-run.ts"
Cohesion: 0.11
Nodes (15): AUDIT_RUN_STATUSES, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), demoStorePresetSchema, diagnosticsSchema, enhancementDetectionSchema, fileErrorSchema (+7 more)

### Community 30 - "runFilteredRankingCheck.ts"
Cohesion: 0.12
Nodes (20): currentRows(), GET(), parseQuery(), POST(), buildListingUrl(), CatalogFilter, CatalogRankResult, extractCatalogCards() (+12 more)

### Community 31 - "available-features/route.ts"
Cohesion: 0.29
Nodes (7): GET(), EnhancementDetection, FeatureMatrixRow, FeatureMatrixTable(), AVAILABLE_FEATURES, AvailableFeature, featureStatus

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.22
Nodes (14): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags() (+6 more)

### Community 35 - "uploadThemeVersion.ts"
Cohesion: 0.26
Nodes (10): POST(), sha256(), uploadThemeVersion(), UploadVersionResult, versionErrorMessage(), deleteZip(), getBucket(), readZipBuffer() (+2 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.06
Nodes (47): parseDemoStorePresets(), POST(), GET(), toPlainRecord(), detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine() (+39 more)

### Community 37 - "shopify/index.ts"
Cohesion: 0.16
Nodes (11): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+3 more)

### Community 38 - "ReportContent.tsx"
Cohesion: 0.12
Nodes (16): AuditDiagnostics, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersionsNote(), FindingStatus, FindingSummary, ReadinessPanel() (+8 more)

### Community 39 - "runRules.ts"
Cohesion: 0.16
Nodes (16): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules() (+8 more)

### Community 40 - "audit/route.ts"
Cohesion: 0.22
Nodes (10): POST(), localUploadSource(), ThemeSource, AuditRunDoc, cascadeDeleteVersion(), ThemeVersion, ThemeVersionDoc, themeVersionSchema (+2 more)

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 43 - "FutureUpdatesContent.tsx"
Cohesion: 0.19
Nodes (12): EnhancementPoint, Example, SOURCE_LABELS, STATUS_LABELS, STATUSES, TIER_STYLES, ADOPTION_TIERS, AdoptionTier (+4 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.11
Nodes (19): Card(), CardHeader(), CheckTotals, CoreWebVitalsTable(), formatDate(), formatMs(), healthTone(), isDesktopPerformanceFinding() (+11 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 47 - "enhancement-point.ts"
Cohesion: 0.19
Nodes (11): GET(), PATCH(), ENHANCEMENT_CATEGORIES, ENHANCEMENT_SOURCES, ENHANCEMENT_STATUSES, EnhancementPointDoc, enhancementPointSchema, exampleSchema (+3 more)

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

### Community 53 - "seed-native-capabilities.ts"
Cohesion: 0.16
Nodes (12): tierForPercentage(), NATIVE_CAPABILITY_COMPLETENESS, Category, COPY, main(), TrendData, Category, Completeness (+4 more)

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

### Community 59 - "settings/page.tsx"
Cohesion: 0.16
Nodes (10): MaintenanceContent(), MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL, GoogleSheetsPanel(), GoogleStatus, readGoogleBannerFromLocation(), ReadinessConfig (+2 more)

### Community 60 - "themes/route.ts"
Cohesion: 0.17
Nodes (17): GET(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, averageDefined(), categoryScore(), computeScoreboard(), featuresScoreCard() (+9 more)

### Community 61 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 62 - "themeStoreFeatures.ts"
Cohesion: 0.16
Nodes (16): POST(), checkPendingThemeStoreListings(), runDemoStoreCheck(), deriveThemeStoreSlug(), extractFeatureLabels(), extractLatestRelease(), extractPresets(), extractReviewSummary() (+8 more)

### Community 63 - "Button.tsx"
Cohesion: 0.20
Nodes (9): Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, DownloadReportDropdown(), FileFormat, Format (+1 more)

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "enhancementSheetRows.ts"
Cohesion: 0.20
Nodes (11): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SOURCE_LABELS (+3 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "presets.ts"
Cohesion: 0.47
Nodes (4): PATCH(), DemoStorePreset, MAX_PRESETS, sanitizePresets()

### Community 71 - "buildTestTheme.ts"
Cohesion: 0.10
Nodes (9): RuleFinding, buildThemeIndex(), ACCESSIBILITY_RULES, CROSS_FILE_RULES, BASE_LAYOUT, INTERNAL_RULES, SHOPIFY_SETTINGS_RULES, buildTestTheme() (+1 more)

### Community 72 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 73 - "AddThemeModal.tsx"
Cohesion: 0.36
Nodes (4): DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal()

### Community 75 - "[id]/export/route.ts"
Cohesion: 0.18
Nodes (16): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+8 more)

### Community 77 - "insights/page.tsx"
Cohesion: 0.23
Nodes (8): FutureUpdatesContent(), CodeReviewContent(), RequirementsReview(), StoreReviewContent(), formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow

### Community 78 - "ranking/page.tsx"
Cohesion: 0.23
Nodes (8): BreadcrumbItem, Breadcrumbs(), ChartSeries, LineChart(), nearestIndex(), PAD, SERIES_VARS, HistoryData

### Community 79 - "isValidObjectId"
Cohesion: 0.36
Nodes (8): GET(), GET(), PATCH(), GET(), invalidIdResponse(), isValidObjectId(), AuditRun, Finding

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 81 - "theme.ts"
Cohesion: 0.25
Nodes (7): POST(), cascadeDeleteRuns(), Theme, themeDemoStorePresetSchema, ThemeDoc, themeSchema, themeStorePresetSchema

### Community 82 - "[themeId]/route.ts"
Cohesion: 0.64
Nodes (5): GET(), compareVersions(), ParsedVersion, parseVersionForSort(), pickLatestVersion()

### Community 83 - "PageContainer.tsx"
Cohesion: 0.36
Nodes (4): PageContainer(), AuditRunRow, formatDate(), ReportsPage()

### Community 84 - "RequirementsReview.tsx"
Cohesion: 0.25
Nodes (5): ImplementationType, Requirement, RULE_STATUS_LABELS, RULE_STATUS_STYLES, SOURCE_TYPE_LABELS

### Community 85 - "ScoreboardGrid.tsx"
Cohesion: 0.40
Nodes (4): CARD_ACCENTS, ScoreboardGrid(), scoreTone(), ScoreCard

### Community 86 - "VersionsSection.tsx"
Cohesion: 0.40
Nodes (5): AuditTotals, formatDate(), VersionRow, VersionRowView(), VersionsSection()

### Community 87 - "readiness/route.ts"
Cohesion: 0.27
Nodes (9): GET(), PATCH(), DEFAULT_READINESS_CONFIG, ReadinessConfig, loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel (+1 more)

## Knowledge Gaps
- **469 isolated node(s):** `DemoStoreRecord`, `DemoStoreData`, `ThemeStorePreset`, `RankedTheme`, `RankingData` (+464 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `[id]/export/google-sheet/route.ts`, `finding.ts`, `runFilteredRankingCheck.ts`, `available-features/route.ts`, `uploadThemeVersion.ts`, `executeAuditRun.ts`, `runRules.ts`, `audit/route.ts`, `seed-rules.ts`, `enhancement-point.ts`, `seed-native-capabilities.ts`, `themes/route.ts`, `themeStoreFeatures.ts`, `presets.ts`, `oauth.ts`, `[id]/export/route.ts`, `isValidObjectId`, `theme.ts`, `[themeId]/route.ts`, `readiness/route.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `googleapis`, `mongodb`, `package.json`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `executeAuditRun.ts`, `ReportContent.tsx`, `ThemeDetailTabs.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `insights/page.tsx`, `[themeId]/route.ts`, `themes/route.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DemoStoreRecord`, `DemoStoreData`, `ThemeStorePreset` to the rest of the system?**
  _469 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connectToDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.1126984126984127 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._