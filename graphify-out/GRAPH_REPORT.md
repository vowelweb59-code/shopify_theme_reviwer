# Graph Report - Shopify Theme Auditor  (2026-09-21)

## Corpus Check
- 277 files · ~1,572,912 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1346 nodes · 2710 edges · 81 communities (75 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fda53f1c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- theme.ts
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
- available-features/page.tsx
- finding.ts
- extractReadmeVersion.ts
- bugs/index.ts
- demo-store/page.tsx
- cross-file/index.ts
- getPageLabel
- internal/index.ts
- Shopify Theme Auditor
- accessibility/index.ts
- audit-run.ts
- shopify/index.ts
- available-features/route.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- readiness/route.ts
- ReportContent.tsx
- runRules.ts
- uploadThemeVersion.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- seed-rules.ts
- technical-seo/index.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- settings/page.tsx
- themes/page.tsx
- proxy.ts
- deriveChecksForAuditRun.ts
- googleapis
- categoryDashboard.tsx
- insights/page.tsx
- [id]/export/route.ts
- zip.ts
- themeStoreFeatures.ts
- Button.tsx
- enhancementReport.tsx
- enhancementSheetRows.ts
- extractCssStructure.ts
- projectStatus.ts
- [themeId]/route.ts
- accessibility/index.test.ts
- connectToDatabase
- AddThemeModal.tsx
- mongodb
- rankingScheduler.ts
- ScoreboardGrid.tsx
- buildTestTheme.ts
- themeStoreRanking.ts
- templateComposition.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 78 edges
2. `executeAuditRun()` - 19 edges
3. `buildTestTheme()` - 18 edges
4. `isValidObjectId()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `POST()` - 14 edges
8. `runPageSpeedChecksForPresets()` - 14 edges
9. `parseJsonFile()` - 14 edges
10. `getPageLabel()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (81 total, 6 thin omitted)

### Community 0 - "theme.ts"
Cohesion: 0.17
Nodes (12): parseDemoStorePresets(), POST(), GET(), RankingCheckResult, ThemeRankingCheckState, ThemeRankingCheckStateDoc, themeRankingCheckStateSchema, Theme (+4 more)

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
Cohesion: 0.11
Nodes (27): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, extractHtmlStructure(), HtmlStructure, isLiquidExpression(), StackFrame, TEXT_CAPTURE_TAGS, emptyMetaTags() (+19 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.24
Nodes (19): POST(), POST(), SheetEnhancementPoint, SheetFutureUpdatesPoint, getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList() (+11 more)

### Community 6 - "rules.ts"
Cohesion: 0.13
Nodes (12): Rule, RuleContext, RuleFinding, Severity, ThemeIndex, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule (+4 more)

### Community 7 - "AppShell.tsx"
Cohesion: 0.21
Nodes (9): AppShell(), isActive(), MobileNav(), NAV_ITEMS, isActive(), Sidebar(), geistMono, geistSans (+1 more)

### Community 9 - "ThemeDetailTabs.tsx"
Cohesion: 0.16
Nodes (11): BreadcrumbItem, Breadcrumbs(), CheckTotals, ThemeDetail, ThemeDetailTabs(), AuditTotals, formatDate(), VersionRow (+3 more)

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.09
Nodes (21): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+13 more)

### Community 12 - "pageSpeed.ts"
Cohesion: 0.06
Nodes (52): extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts(), isAbortError(), PageFacts, comparePresets(), PresetFacts (+44 more)

### Community 13 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 18 - "available-features/page.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

### Community 19 - "finding.ts"
Cohesion: 0.09
Nodes (27): GET(), GET(), RequirementImplementationType, GET(), cascadeDeleteFindings(), FINDING_CATEGORIES, FINDING_HISTORICAL_STATES, FINDING_LAYERS (+19 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.24
Nodes (9): extractThemeVersionFromZip(), extractVersionFromReadmeText(), extractVersionFromSettingsSchema(), findReadmeFile(), SETTINGS_SCHEMA_RELATIVE_PATH, stripTrailingCommas(), ThemeVersionResult, VERSION_LINE_RE (+1 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "demo-store/page.tsx"
Cohesion: 0.17
Nodes (12): EmptyState(), ResponsiveTable(), TableColumn, DemoStoreData, DemoStorePage(), DemoStoreRecord, durationMs(), formatDateTime() (+4 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "getPageLabel"
Cohesion: 0.10
Nodes (20): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildDiffCsv() (+12 more)

### Community 25 - "internal/index.ts"
Cohesion: 0.16
Nodes (9): headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES, repetitiveSectionAxisRule, sectionTopicText(), settingTextValues(), TemplateJson, TemplateSection (+1 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 29 - "audit-run.ts"
Cohesion: 0.09
Nodes (25): POST(), localUploadSource(), ThemeSource, AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, demoStorePresetSchema (+17 more)

### Community 30 - "shopify/index.ts"
Cohesion: 0.16
Nodes (11): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+3 more)

### Community 31 - "available-features/route.ts"
Cohesion: 0.26
Nodes (8): GET(), EnhancementDetection, FeatureMatrixRow, FeatureMatrixTable(), AVAILABLE_FEATURES, AvailableFeature, featureStatus, featuresScoreCard()

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.19
Nodes (15): parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyParsedFile(), FileType, ParsedFile, countThemeDirectories() (+7 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.06
Nodes (45): GET(), toPlainRecord(), detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics() (+37 more)

### Community 37 - "readiness/route.ts"
Cohesion: 0.27
Nodes (9): GET(), PATCH(), DEFAULT_READINESS_CONFIG, ReadinessConfig, loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel (+1 more)

### Community 38 - "ReportContent.tsx"
Cohesion: 0.12
Nodes (16): AuditDiagnostics, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersionsNote(), FindingStatus, FindingSummary, ReadinessPanel() (+8 more)

### Community 39 - "runRules.ts"
Cohesion: 0.17
Nodes (15): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules() (+7 more)

### Community 40 - "uploadThemeVersion.ts"
Cohesion: 0.25
Nodes (10): POST(), sha256(), uploadThemeVersion(), UploadVersionResult, versionErrorMessage(), deleteZip(), getBucket(), readZipBuffer() (+2 more)

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 43 - "enhancement-point.ts"
Cohesion: 0.07
Nodes (36): GET(), PATCH(), EnhancementPoint, Example, FutureUpdatesContent(), SOURCE_LABELS, STATUS_LABELS, STATUSES (+28 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.11
Nodes (19): Card(), CardHeader(), CheckTotals, CoreWebVitalsTable(), formatDate(), formatMs(), healthTone(), isDesktopPerformanceFinding() (+11 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 47 - "technical-seo/index.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

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
Nodes (16): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+8 more)

### Community 53 - "settings/page.tsx"
Cohesion: 0.14
Nodes (12): Tab, TabbedPageClient(), MaintenanceContent(), MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL, GoogleSheetsPanel(), GoogleStatus (+4 more)

### Community 54 - "themes/page.tsx"
Cohesion: 0.16
Nodes (19): CheckTotals, formatDate(), healthPercent(), healthTone(), isStale(), isVersionMismatch(), PrioritizedThemeRow, ROW_TONE_CLASS (+11 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "deriveChecksForAuditRun.ts"
Cohesion: 0.16
Nodes (12): CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList(), matchesSearch(), STATUS_FILTERS, baseArgs, CategoryChecks (+4 more)

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.14
Nodes (12): CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES, SOURCE_TYPE_LABELS, StoreReviewContent() (+4 more)

### Community 60 - "[id]/export/route.ts"
Cohesion: 0.17
Nodes (17): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+9 more)

### Community 61 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 62 - "themeStoreFeatures.ts"
Cohesion: 0.20
Nodes (13): checkPendingThemeStoreListings(), runDemoStoreCheck(), deriveThemeStoreSlug(), extractFeatureLabels(), extractLatestRelease(), extractPresets(), fetchThemeStoreFeatureLabels(), LatestRelease (+5 more)

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
Cohesion: 0.32
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, extractCssStructure(), ParsedCssInfo

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "[themeId]/route.ts"
Cohesion: 0.26
Nodes (14): GET(), GET(), EnhancementDetectionRecord, EnhancementReportPoint, compareVersions(), ParsedVersion, parseVersionForSort(), pickLatestVersion() (+6 more)

### Community 72 - "connectToDatabase"
Cohesion: 0.23
Nodes (14): GET(), GET(), PATCH(), GET(), GET(), GET(), POST(), invalidIdResponse() (+6 more)

### Community 73 - "AddThemeModal.tsx"
Cohesion: 0.19
Nodes (9): POST(), PATCH(), DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal(), DemoStorePreset, MAX_PRESETS (+1 more)

### Community 75 - "rankingScheduler.ts"
Cohesion: 0.29
Nodes (9): POST(), register(), globalForScheduler, randomNextDelayMs(), runAndReschedule(), scheduleTimer(), startThemeRankingScheduler(), triggerThemeRankingCheckNow() (+1 more)

### Community 77 - "ScoreboardGrid.tsx"
Cohesion: 0.40
Nodes (4): CARD_ACCENTS, ScoreboardGrid(), scoreTone(), ScoreCard

### Community 78 - "buildTestTheme.ts"
Cohesion: 0.36
Nodes (8): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), buildTestTheme(), ThemeParseResult

### Community 79 - "themeStoreRanking.ts"
Cohesion: 0.43
Nodes (6): CatalogRankResult, extractCatalogCards(), extractLastPage(), fetchListingPage(), findThemeStoreRankings(), PageCardEntry

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

## Knowledge Gaps
- **454 isolated node(s):** `DemoStoreRecord`, `DemoStoreData`, `ThemeStorePreset`, `RankedTheme`, `RankingData` (+449 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `theme.ts`, `oauth.ts`, `executeAuditRun.ts`, `[id]/export/google-sheet/route.ts`, `readiness/route.ts`, `runRules.ts`, `[themeId]/route.ts`, `AddThemeModal.tsx`, `uploadThemeVersion.ts`, `enhancement-point.ts`, `rankingScheduler.ts`, `seed-rules.ts`, `finding.ts`, `[id]/export/route.ts`, `audit-run.ts`, `themeStoreFeatures.ts`, `available-features/route.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `ThemeDetailTabs.tsx` to `executeAuditRun.ts`, `[themeId]/route.ts`, `ReportContent.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `pageSpeed.ts`, `insights/page.tsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `FINDING_CATEGORIES` connect `finding.ts` to `sheetRows.ts`, `deriveChecksForAuditRun.ts`, `rules.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DemoStoreRecord`, `DemoStoreData`, `ThemeStorePreset` to the rest of the system?**
  _454 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._