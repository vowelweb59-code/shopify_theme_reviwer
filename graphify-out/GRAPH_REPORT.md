# Graph Report - Shopify Theme Auditor  (2026-09-21)

## Corpus Check
- 274 files · ~1,571,524 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1325 nodes · 2670 edges · 80 communities (74 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b5f17441`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- reports/[id]/route.ts
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
- diffFindings.ts
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
- computeScoreboard.ts
- buildTestTheme.ts
- Shopify Theme Auditor
- accessibility/index.ts
- uploadThemeVersion.ts
- audit-run.ts
- featureStatus
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- seed-rules.ts
- ReportContent.tsx
- runRules.ts
- enhancementSheetFormatting.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- enhancementSheetRows.ts
- technical-seo/index.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- settings/page.tsx
- themes/page.tsx
- proxy.ts
- AllChecksList.tsx
- googleapis
- categoryDashboard.tsx
- insights/page.tsx
- [id]/export/route.ts
- zip.ts
- themeStoreFeatures.ts
- Button.tsx
- enhancementReport.tsx
- shopify/index.ts
- extractCssStructure.ts
- projectStatus.ts
- [themeId]/route.ts
- accessibility/index.test.ts
- connectToDatabase
- AddThemeModal.tsx
- mongodb
- check-ranking/route.ts
- ScoreboardGrid.tsx
- PageSpeedContent.tsx
- templateComposition.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 75 edges
2. `executeAuditRun()` - 19 edges
3. `isValidObjectId()` - 18 edges
4. `buildTestTheme()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `runPageSpeedChecksForPresets()` - 14 edges
8. `parseJsonFile()` - 14 edges
9. `getPageLabel()` - 14 edges
10. `POST()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `POST()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/themes/check-ranking/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (80 total, 6 thin omitted)

### Community 0 - "reports/[id]/route.ts"
Cohesion: 0.25
Nodes (12): GET(), GET(), PATCH(), GET(), GET(), invalidIdResponse(), isValidObjectId(), buildEnhancementReportForRun() (+4 more)

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
Cohesion: 0.09
Nodes (21): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+13 more)

### Community 12 - "pageSpeed.ts"
Cohesion: 0.06
Nodes (53): extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts(), isAbortError(), PageFacts, comparePresets(), PresetFacts (+45 more)

### Community 13 - "diffFindings.ts"
Cohesion: 0.17
Nodes (18): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+10 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 18 - "available-features/page.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

### Community 19 - "finding.ts"
Cohesion: 0.11
Nodes (24): RequirementImplementationType, cascadeDeleteFindings(), FINDING_CATEGORIES, FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_STATUSES, FindingDoc, findingSchema (+16 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.24
Nodes (9): extractThemeVersionFromZip(), extractVersionFromReadmeText(), extractVersionFromSettingsSchema(), findReadmeFile(), SETTINGS_SCHEMA_RELATIVE_PATH, stripTrailingCommas(), ThemeVersionResult, VERSION_LINE_RE (+1 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "demo-store/page.tsx"
Cohesion: 0.21
Nodes (10): EmptyState(), ResponsiveTable(), TableColumn, DemoStoreData, DemoStorePage(), DemoStoreRecord, durationMs(), formatDateTime() (+2 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "computeScoreboard.ts"
Cohesion: 0.21
Nodes (12): averageDefined(), categoryScore(), computeScoreboard(), featuresScoreCard(), opportunitiesScoreCard(), performanceScoreCard(), baseArgs, CategoryChecks (+4 more)

### Community 25 - "buildTestTheme.ts"
Cohesion: 0.14
Nodes (16): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), headingMatchesSectionNameRule, INTERNAL_RULES (+8 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 29 - "uploadThemeVersion.ts"
Cohesion: 0.19
Nodes (13): POST(), POST(), sha256(), localUploadSource(), ThemeSource, uploadThemeVersion(), UploadVersionResult, versionErrorMessage() (+5 more)

### Community 30 - "audit-run.ts"
Cohesion: 0.10
Nodes (22): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, demoStorePresetSchema, diagnosticsSchema, enhancementDetectionSchema, fileErrorSchema (+14 more)

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
Cohesion: 0.16
Nodes (19): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseResult, ThemeParseTiming (+11 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (27): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics(), ENHANCEMENT_DETECTORS, EnhancementDetector (+19 more)

### Community 37 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 38 - "ReportContent.tsx"
Cohesion: 0.12
Nodes (16): AuditDiagnostics, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersionsNote(), FindingStatus, FindingSummary, ReadinessPanel() (+8 more)

### Community 39 - "runRules.ts"
Cohesion: 0.16
Nodes (16): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules() (+8 more)

### Community 40 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

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

### Community 46 - "enhancementSheetRows.ts"
Cohesion: 0.16
Nodes (13): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetEnhancementPoint (+5 more)

### Community 47 - "technical-seo/index.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

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

### Community 53 - "settings/page.tsx"
Cohesion: 0.14
Nodes (12): Tab, TabbedPageClient(), MaintenanceContent(), MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL, GoogleSheetsPanel(), GoogleStatus (+4 more)

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
Cohesion: 0.18
Nodes (8): CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES, SOURCE_TYPE_LABELS, StoreReviewContent()

### Community 60 - "[id]/export/route.ts"
Cohesion: 0.06
Nodes (44): CONTENT_TYPES, Format, FORMATS, GET(), GET(), PATCH(), computeCoverage(), computeCoverageByCategory() (+36 more)

### Community 61 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 62 - "themeStoreFeatures.ts"
Cohesion: 0.23
Nodes (11): checkPendingThemeStoreListings(), runDemoStoreCheck(), deriveThemeStoreSlug(), extractFeatureLabels(), extractLatestRelease(), fetchThemeStoreFeatureLabels(), LatestRelease, ThemeStoreFeaturesResult (+3 more)

### Community 63 - "Button.tsx"
Cohesion: 0.20
Nodes (9): Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, DownloadReportDropdown(), FileFormat, Format (+1 more)

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "shopify/index.ts"
Cohesion: 0.16
Nodes (11): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+3 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "[themeId]/route.ts"
Cohesion: 0.26
Nodes (12): GET(), POST(), GET(), PATCH(), compareVersions(), ParsedVersion, parseVersionForSort(), pickLatestVersion() (+4 more)

### Community 72 - "connectToDatabase"
Cohesion: 0.16
Nodes (17): parseDemoStorePresets(), POST(), GET(), GET(), GET(), GET(), GET(), GET() (+9 more)

### Community 73 - "AddThemeModal.tsx"
Cohesion: 0.36
Nodes (4): DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal()

### Community 75 - "check-ranking/route.ts"
Cohesion: 0.36
Nodes (7): POST(), extractLastPage(), extractThemeCardSlugs(), fetchListingPage(), findThemeStoreRankings(), PageThemeEntry, ThemeRankResult

### Community 77 - "ScoreboardGrid.tsx"
Cohesion: 0.40
Nodes (4): CARD_ACCENTS, ScoreboardGrid(), scoreTone(), ScoreCard

### Community 78 - "PageSpeedContent.tsx"
Cohesion: 0.60
Nodes (4): formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

## Knowledge Gaps
- **446 isolated node(s):** `DemoStoreRecord`, `DemoStoreData`, `RankedTheme`, `demoStoreThemeRecordSchema`, `DemoStoreThemeRecordDoc` (+441 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `reports/[id]/route.ts`, `oauth.ts`, `[id]/export/google-sheet/route.ts`, `[themeId]/route.ts`, `runRules.ts`, `seed-rules.ts`, `enhancement-point.ts`, `check-ranking/route.ts`, `diffFindings.ts`, `finding.ts`, `themeStoreFeatures.ts`, `[id]/export/route.ts`, `uploadThemeVersion.ts`, `audit-run.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `executeAuditRun.ts`, `[themeId]/route.ts`, `ReportContent.tsx`, `ThemeDetailTabs.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `PageSpeedContent.tsx`, `computeScoreboard.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `googleapis`, `mongodb`, `package.json`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `DemoStoreRecord`, `DemoStoreData`, `RankedTheme` to the rest of the system?**
  _446 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._