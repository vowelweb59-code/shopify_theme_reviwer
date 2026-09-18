# Graph Report - Shopify Theme Auditor  (2026-09-18)

## Corpus Check
- 255 files · ~1,563,827 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1274 nodes · 2578 edges · 74 communities (68 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ce72b4d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- diffFindings.ts
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
- audit-run.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- audit/route.ts
- deriveChecksForAuditRun.ts
- extractReadmeVersion.ts
- bugs/index.ts
- connectToDatabase
- cross-file/index.ts
- buildLineIndex
- internal/index.ts
- Shopify Theme Auditor
- accessibility/index.ts
- [themeId]/route.ts
- [id]/export/route.ts
- runRules.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- themes/page.tsx
- available-features/page.tsx
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
- app/page.tsx
- proxy.ts
- ReportContent.tsx
- googleapis
- categoryDashboard.tsx
- insights/page.tsx
- finding.ts
- computeScoreboard.ts
- Button.tsx
- enhancementReport.tsx
- shopify/index.ts
- extractCssStructure.ts
- projectStatus.ts
- ScoreboardGrid.tsx
- accessibility/index.test.ts
- AddThemeModal.tsx
- mongodb
- buildTestTheme.ts
- audit-settings.ts
- templateComposition.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 69 edges
2. `executeAuditRun()` - 19 edges
3. `isValidObjectId()` - 18 edges
4. `buildTestTheme()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `getPageLabel()` - 14 edges
8. `runPageSpeedChecksForPresets()` - 14 edges
9. `parseJsonFile()` - 14 edges
10. `POST()` - 14 edges

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

## Communities (74 total, 6 thin omitted)

### Community 0 - "diffFindings.ts"
Cohesion: 0.07
Nodes (35): GET(), toPlainRecord(), CoverageResult, attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffFinding (+27 more)

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
Cohesion: 0.13
Nodes (23): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+15 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.30
Nodes (16): POST(), POST(), getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError, GoogleSheetSpreadsheetNotFoundError (+8 more)

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
Nodes (57): formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow, extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts() (+49 more)

### Community 13 - "audit-run.ts"
Cohesion: 0.17
Nodes (11): AUDIT_RUN_STATUSES, auditRunSchema, auditRunSummarySchema, demoStorePresetSchema, diagnosticsSchema, enhancementDetectionSchema, fileErrorSchema, liveCheckErrorSchema (+3 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.28
Nodes (11): extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys(), isLocaleFilePath(), isSectionGroupPath(), isSettingsSchemaPath(), isTemplateJsonPath() (+3 more)

### Community 18 - "audit/route.ts"
Cohesion: 0.27
Nodes (8): PATCH(), POST(), DemoStorePreset, MAX_PRESETS, sanitizePresets(), localUploadSource(), AuditRunDoc, ThemeZip

### Community 19 - "deriveChecksForAuditRun.ts"
Cohesion: 0.05
Nodes (43): GET(), GET(), RequirementImplementationType, SeverityBadge(), CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList() (+35 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.11
Nodes (22): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, ExtractedTheme, extractEntries(), extractThemeZip(), MAX_FILE_COUNT (+14 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "connectToDatabase"
Cohesion: 0.19
Nodes (16): GET(), GET(), parseDemoStorePresets(), POST(), PATCH(), GET(), GET(), GET() (+8 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "buildLineIndex"
Cohesion: 0.31
Nodes (6): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), ParsedJsImport

### Community 25 - "internal/index.ts"
Cohesion: 0.16
Nodes (9): headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES, repetitiveSectionAxisRule, sectionTopicText(), settingTextValues(), TemplateJson, TemplateSection (+1 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 29 - "[themeId]/route.ts"
Cohesion: 0.16
Nodes (20): GET(), GET(), GET(), POST(), GET(), POST(), sha256(), compareVersions() (+12 more)

### Community 30 - "[id]/export/route.ts"
Cohesion: 0.12
Nodes (24): CONTENT_TYPES, Format, FORMATS, GET(), GET(), GET(), PATCH(), computeCoverage() (+16 more)

### Community 31 - "runRules.ts"
Cohesion: 0.17
Nodes (15): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules() (+7 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.23
Nodes (12): extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), ThemeParseTiming, emptyMetaTags(), emptyParsedFile(), FileType (+4 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (31): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics(), ENHANCEMENT_DETECTORS, EnhancementDetector (+23 more)

### Community 37 - "themes/page.tsx"
Cohesion: 0.39
Nodes (8): CheckTotals, formatDate(), healthPercent(), healthTone(), scoreCard(), scoreCell(), ThemeRow, ThemesPage()

### Community 38 - "available-features/page.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

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
Cohesion: 0.13
Nodes (17): CheckTotals, CoreWebVitalsTable(), formatDate(), formatMs(), healthTone(), isDesktopPerformanceFinding(), OverviewPanel(), Props (+9 more)

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
Nodes (20): DiffStatus, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX (+12 more)

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

### Community 54 - "app/page.tsx"
Cohesion: 0.21
Nodes (9): Card(), CardHeader(), EmptyState(), ResponsiveTable(), TableColumn, Dashboard(), DashboardData, formatDate() (+1 more)

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
Cohesion: 0.08
Nodes (20): Tab, TabbedPageClient(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES (+12 more)

### Community 60 - "finding.ts"
Cohesion: 0.13
Nodes (18): ThemeSource, deleteZip(), getBucket(), readZipBuffer(), storeZipBuffer(), cascadeDeleteFindings(), FINDING_HISTORICAL_STATES, FINDING_LAYERS (+10 more)

### Community 62 - "computeScoreboard.ts"
Cohesion: 0.33
Nodes (9): AVAILABLE_FEATURES, AvailableFeature, featureStatus, averageDefined(), categoryScore(), computeScoreboard(), featuresScoreCard(), opportunitiesScoreCard() (+1 more)

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
Cohesion: 0.28
Nodes (7): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, extractCssStructure(), ParsedCssInfo, ParsedParseError

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "ScoreboardGrid.tsx"
Cohesion: 0.40
Nodes (4): CARD_ACCENTS, ScoreboardGrid(), scoreTone(), ScoreCard

### Community 72 - "AddThemeModal.tsx"
Cohesion: 0.36
Nodes (4): DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal()

### Community 75 - "buildTestTheme.ts"
Cohesion: 0.36
Nodes (8): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), buildTestTheme(), ThemeParseResult

### Community 76 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 80 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

## Knowledge Gaps
- **432 isolated node(s):** `CheckTotals`, `ThemeRow`, `PdfFindingRow`, `PdfSummary`, `XlsxFinding` (+427 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `diffFindings.ts`, `oauth.ts`, `[id]/export/google-sheet/route.ts`, `enhancement-point.ts`, `audit/route.ts`, `deriveChecksForAuditRun.ts`, `finding.ts`, `[themeId]/route.ts`, `[id]/export/route.ts`, `runRules.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `executeAuditRun.ts`, `ThemeDetailTabs.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `ReportContent.tsx`, `[themeId]/route.ts`, `computeScoreboard.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `PageContainer()` connect `available-features/page.tsx` to `ThemeDetailTabs.tsx`, `insights/page.tsx`, `themes/page.tsx`, `app/page.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CheckTotals`, `ThemeRow`, `PdfFindingRow` to the rest of the system?**
  _432 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `diffFindings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._