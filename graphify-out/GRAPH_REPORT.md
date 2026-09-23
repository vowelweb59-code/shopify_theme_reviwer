# Graph Report - Shopify Theme Auditor  (2026-09-23)

## Corpus Check
- 287 files · ~1,580,544 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1397 nodes · 2820 edges · 80 communities (75 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4978f7fa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- theme.ts
- devDependencies
- dependencies
- compilerOptions
- types.ts
- sheetsExport.ts
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
- deriveChecksForAuditRun.ts
- extractReadmeVersion.ts
- bugs/index.ts
- available-features/page.tsx
- cross-file/index.ts
- [id]/export/route.ts
- internal/index.ts
- Shopify Theme Auditor
- accessibility/index.ts
- finding.ts
- rankingScheduler.ts
- featureStatus
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- diffFindings.ts
- executeAuditRun.ts
- shopify/index.ts
- ReportContent.tsx
- runRules.ts
- audit/route.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- seed-rules.ts
- updatePriority.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- audit-settings.ts
- themes/page.tsx
- proxy.ts
- AllChecksList.tsx
- googleapis
- categoryDashboard.tsx
- insights/page.tsx
- computeScoreboard.ts
- zip.ts
- themeStoreFeatures.ts
- Button.tsx
- enhancementReport.tsx
- [id]/export/google-sheet/route.ts
- extractCssStructure.ts
- projectStatus.ts
- buildTestTheme.ts
- oauth.ts
- AddThemeModal.tsx
- mongodb
- ranking/page.tsx
- connectToDatabase
- templateComposition.ts
- [themeId]/route.ts
- PageContainer.tsx

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
  app/api/themes/ranking/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/themes/[themeId]/history/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (80 total, 5 thin omitted)

### Community 0 - "theme.ts"
Cohesion: 0.13
Nodes (17): parseDemoStorePresets(), POST(), GET(), GET(), POST(), RankingCheckResult, ThemeRankHistory, ThemeRankHistoryDoc (+9 more)

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

### Community 5 - "sheetsExport.ts"
Cohesion: 0.26
Nodes (17): POST(), POST(), SheetEnhancementPoint, getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError (+9 more)

### Community 6 - "rules.ts"
Cohesion: 0.11
Nodes (14): Rule, RuleContext, Severity, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, CHECKS, PresenceCheck (+6 more)

### Community 7 - "AppShell.tsx"
Cohesion: 0.21
Nodes (9): AppShell(), isActive(), MobileNav(), NAV_ITEMS, isActive(), Sidebar(), geistMono, geistSans (+1 more)

### Community 9 - "ThemeDetailTabs.tsx"
Cohesion: 0.21
Nodes (8): CheckTotals, ThemeDetail, ThemeDetailTabs(), AuditTotals, formatDate(), VersionRow, VersionRowView(), VersionsSection()

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.09
Nodes (21): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+13 more)

### Community 12 - "pageSpeed.ts"
Cohesion: 0.06
Nodes (57): formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow, extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts() (+49 more)

### Community 13 - "enhancementSheetFormatting.ts"
Cohesion: 0.13
Nodes (17): ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND (+9 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 18 - "demo-store/page.tsx"
Cohesion: 0.12
Nodes (17): EmptyState(), ResponsiveTable(), TableColumn, DemoStoreData, DemoStorePage(), DemoStoreRecord, durationMs(), FilteredRankingData (+9 more)

### Community 19 - "deriveChecksForAuditRun.ts"
Cohesion: 0.09
Nodes (26): GET(), GET(), RequirementImplementationType, GET(), baseArgs, CategoryChecks, CheckEvidence, CheckItem (+18 more)

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

### Community 24 - "[id]/export/route.ts"
Cohesion: 0.06
Nodes (45): CONTENT_TYPES, Format, FORMATS, GET(), GET(), GET(), PATCH(), computeCoverage() (+37 more)

### Community 25 - "internal/index.ts"
Cohesion: 0.15
Nodes (14): basenameNoExt(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, headingMatchesSectionNameRule, MERCHANDISING_AXES (+6 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 29 - "finding.ts"
Cohesion: 0.11
Nodes (22): AUDIT_RUN_STATUSES, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), demoStorePresetSchema, diagnosticsSchema, enhancementDetectionSchema, fileErrorSchema (+14 more)

### Community 30 - "rankingScheduler.ts"
Cohesion: 0.09
Nodes (30): POST(), currentRows(), GET(), parseQuery(), POST(), register(), buildListingUrl(), CatalogFilter (+22 more)

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
Cohesion: 0.22
Nodes (14): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags() (+6 more)

### Community 35 - "diffFindings.ts"
Cohesion: 0.20
Nodes (15): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+7 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (30): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics(), ENHANCEMENT_DETECTORS, EnhancementDetector (+22 more)

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
Cohesion: 0.21
Nodes (12): PATCH(), POST(), sanitizePresets(), localUploadSource(), ThemeSource, deleteZip(), getBucket(), readZipBuffer() (+4 more)

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 43 - "enhancement-point.ts"
Cohesion: 0.07
Nodes (37): GET(), PATCH(), EnhancementPoint, Example, FutureUpdatesContent(), SOURCE_LABELS, STATUS_LABELS, STATUSES (+29 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.11
Nodes (19): Card(), CardHeader(), CheckTotals, CoreWebVitalsTable(), formatDate(), formatMs(), healthTone(), isDesktopPerformanceFinding() (+11 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 47 - "updatePriority.ts"
Cohesion: 0.33
Nodes (5): computeUpdatePriority(), NOW, UpdatePriorityInput, UpdatePriorityResult, WEIGHTS

### Community 48 - "sheetRows.ts"
Cohesion: 0.13
Nodes (20): DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX (+12 more)

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

### Community 53 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 54 - "themes/page.tsx"
Cohesion: 0.26
Nodes (14): CheckTotals, formatDate(), healthPercent(), healthTone(), isStale(), isVersionMismatch(), PrioritizedThemeRow, ROW_TONE_CLASS (+6 more)

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

### Community 60 - "computeScoreboard.ts"
Cohesion: 0.23
Nodes (11): CARD_ACCENTS, ScoreboardGrid(), scoreTone(), buildEnhancementReportForRun(), averageDefined(), categoryScore(), computeScoreboard(), featuresScoreCard() (+3 more)

### Community 61 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 62 - "themeStoreFeatures.ts"
Cohesion: 0.14
Nodes (18): checkPendingThemeStoreListings(), runDemoStoreCheck(), deriveThemeStoreSlug(), extractDemoStoreIframeUrl(), extractFeatureLabels(), extractLatestRelease(), extractPresets(), extractReviewSummary() (+10 more)

### Community 63 - "Button.tsx"
Cohesion: 0.20
Nodes (9): Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, DownloadReportDropdown(), FileFormat, Format (+1 more)

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.24
Nodes (10): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, SheetFutureUpdatesPoint, SOURCE_LABELS, STATUS_LABELS (+2 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 71 - "buildTestTheme.ts"
Cohesion: 0.10
Nodes (9): RuleFinding, buildThemeIndex(), ACCESSIBILITY_RULES, CROSS_FILE_RULES, BASE_LAYOUT, INTERNAL_RULES, SHOPIFY_SETTINGS_RULES, buildTestTheme() (+1 more)

### Community 72 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 73 - "AddThemeModal.tsx"
Cohesion: 0.24
Nodes (6): DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal(), DemoStorePreset, MAX_PRESETS

### Community 78 - "ranking/page.tsx"
Cohesion: 0.23
Nodes (8): BreadcrumbItem, Breadcrumbs(), ChartSeries, LineChart(), nearestIndex(), PAD, SERIES_VARS, HistoryData

### Community 79 - "connectToDatabase"
Cohesion: 0.21
Nodes (15): GET(), GET(), GET(), PATCH(), GET(), GET(), GET(), POST() (+7 more)

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 82 - "[themeId]/route.ts"
Cohesion: 0.18
Nodes (17): GET(), POST(), GET(), POST(), EnhancementDetectionRecord, EnhancementReportPoint, sha256(), compareVersions() (+9 more)

### Community 83 - "PageContainer.tsx"
Cohesion: 0.36
Nodes (4): PageContainer(), AuditRunRow, formatDate(), ReportsPage()

## Knowledge Gaps
- **470 isolated node(s):** `CheckTotals`, `Props`, `ReportFinding`, `ReportEnhancementPoint`, `SEVERITY_ORDER` (+465 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `theme.ts`, `[id]/export/google-sheet/route.ts`, `diffFindings.ts`, `sheetsExport.ts`, `runRules.ts`, `oauth.ts`, `audit/route.ts`, `enhancement-point.ts`, `seed-rules.ts`, `[themeId]/route.ts`, `deriveChecksForAuditRun.ts`, `[id]/export/route.ts`, `themeStoreFeatures.ts`, `rankingScheduler.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `executeAuditRun.ts`, `ReportContent.tsx`, `ThemeDetailTabs.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `[themeId]/route.ts`, `computeScoreboard.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `FINDING_CATEGORIES` connect `deriveChecksForAuditRun.ts` to `sheetRows.ts`, `finding.ts`, `rules.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CheckTotals`, `Props`, `ReportFinding` to the rest of the system?**
  _470 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `theme.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12666666666666668 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._