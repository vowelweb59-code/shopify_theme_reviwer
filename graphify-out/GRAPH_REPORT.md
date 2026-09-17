# Graph Report - Shopify Theme Auditor  (2026-09-17)

## Corpus Check
- 239 files · ~1,559,571 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1231 nodes · 2434 edges · 75 communities (67 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9844097b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AllChecksList.tsx
- devDependencies
- dependencies
- compilerOptions
- types.ts
- [id]/export/google-sheet/route.ts
- liveCheck.ts
- AppShell.tsx
- ThemeDetailTabs.tsx
- settings.ts
- findings.tsx
- themes/page.tsx
- [id]/export/route.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- finding.ts
- extractReadmeVersion.ts
- bugs/index.ts
- connectToDatabase
- cross-file/index.ts
- pageSpeed.ts
- buildTestTheme.ts
- Shopify Theme Auditor
- accessibility/index.ts
- audit-run.ts
- reports/[id]/route.ts
- runRules.ts
- registry.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- technical-seo/index.ts
- diffFindings.ts
- liquidJson.ts
- enhancementSheetFormatting.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- enhancementSheetRows.ts
- accessibility/index.test.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- getPageLabel
- app/page.tsx
- proxy.ts
- ReportContent.tsx
- seed-rules.ts
- categoryDashboard.tsx
- insights/page.tsx
- templateComposition.ts
- PageContainer.tsx
- available-features/route.ts
- colorContrast.ts
- enhancementReport.tsx
- rules.ts
- extractCssStructure.ts
- projectStatus.ts
- AddThemeModal.tsx
- next
- react
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 69 edges
2. `isValidObjectId()` - 18 edges
3. `executeAuditRun()` - 18 edges
4. `buildTestTheme()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `parseJsonFile()` - 14 edges
8. `getPageLabel()` - 14 edges
9. `POST()` - 14 edges
10. `AuditRun` - 14 edges

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

## Communities (75 total, 8 thin omitted)

### Community 0 - "AllChecksList.tsx"
Cohesion: 0.21
Nodes (9): SeverityBadge(), CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList(), matchesSearch(), STATUS_FILTERS, CategoryChecks (+1 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (20): exceljs, googleapis, htmlparser2, lucide-react, mongodb, mongoose, dependencies, exceljs (+12 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.30
Nodes (16): POST(), POST(), getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError, GoogleSheetSpreadsheetNotFoundError (+8 more)

### Community 6 - "liveCheck.ts"
Cohesion: 0.13
Nodes (24): checkResponsiveReachability(), collectFocusIndicatorSamples(), comparePresets(), ContrastSample, evaluateReachabilityInPage(), extractLoadedPageFacts(), extractPageFacts(), findAndClickMenuTriggerInPage() (+16 more)

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

### Community 12 - "themes/page.tsx"
Cohesion: 0.29
Nodes (7): EmptyState(), CheckTotals, formatDate(), healthPercent(), healthTone(), ThemeRow, ThemesPage()

### Community 13 - "[id]/export/route.ts"
Cohesion: 0.12
Nodes (21): CONTENT_TYPES, Format, FORMATS, GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult, ReadinessResult (+13 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 19 - "finding.ts"
Cohesion: 0.09
Nodes (30): CheckStatus, GET(), GET(), GET(), RequirementImplementationType, GET(), cascadeDeleteFindings(), FINDING_CATEGORIES (+22 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.11
Nodes (22): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, ExtractedTheme, extractEntries(), extractThemeZip(), MAX_FILE_COUNT (+14 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "connectToDatabase"
Cohesion: 0.26
Nodes (13): GET(), GET(), PATCH(), GET(), GET(), GET(), invalidIdResponse(), isValidObjectId() (+5 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "pageSpeed.ts"
Cohesion: 0.11
Nodes (27): findFirstProductLink(), PresetLiveCheckError, averageDefined(), collectPlaywrightMetrics(), discoverPageUrls(), extractCoreMetrics(), extractOpportunityFindings(), FallbackMetrics (+19 more)

### Community 25 - "buildTestTheme.ts"
Cohesion: 0.13
Nodes (15): getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES (+7 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.10
Nodes (16): ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule, COLOR_LIKE_PROPS, colorContrastRule, cssOrderRule, focusOrderRule (+8 more)

### Community 29 - "audit-run.ts"
Cohesion: 0.06
Nodes (55): GET(), GET(), POST(), GET(), PATCH(), POST(), POST(), sha256() (+47 more)

### Community 30 - "reports/[id]/route.ts"
Cohesion: 0.16
Nodes (16): GET(), GET(), PATCH(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, computeReadiness(), DEFAULT_READINESS_CONFIG (+8 more)

### Community 31 - "runRules.ts"
Cohesion: 0.17
Nodes (17): loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary (+9 more)

### Community 32 - "registry.ts"
Cohesion: 0.12
Nodes (11): Rule, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule (+3 more)

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.23
Nodes (13): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags() (+5 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (32): parseDemoStorePresets(), POST(), detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics() (+24 more)

### Community 37 - "technical-seo/index.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

### Community 38 - "diffFindings.ts"
Cohesion: 0.19
Nodes (14): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+6 more)

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
Nodes (36): GET(), PATCH(), EnhancementPoint, Example, SOURCE_LABELS, STATUS_LABELS, STATUSES, TIER_STYLES (+28 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.23
Nodes (7): Card(), CardHeader(), CheckTotals, formatDate(), healthTone(), OverviewPanel(), Props

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "enhancementSheetRows.ts"
Cohesion: 0.16
Nodes (13): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetEnhancementPoint (+5 more)

### Community 48 - "sheetRows.ts"
Cohesion: 0.13
Nodes (21): DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX (+13 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "sheetsFormatting.ts"
Cohesion: 0.13
Nodes (12): buildSheetFormattingRequests(), CATEGORY_TAB_COLORS, COLUMN_WIDTHS, HEADER_BACKGROUND, HEADER_TEXT, RESOLVED_COLUMN_INDEX, RGB, SEVERITY_COLORS (+4 more)

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "diff.tsx"
Cohesion: 0.12
Nodes (15): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+7 more)

### Community 53 - "getPageLabel"
Cohesion: 0.21
Nodes (10): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildDiffCsv() (+2 more)

### Community 54 - "app/page.tsx"
Cohesion: 0.24
Nodes (10): ResponsiveTable(), TableColumn, Dashboard(), DashboardData, formatDate(), healthTone(), AuditHistoryRow, AuditHistoryTable() (+2 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "ReportContent.tsx"
Cohesion: 0.12
Nodes (17): AuditDiagnostics, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersionsNote(), FindingStatus, FindingSummary, ReadinessPanel() (+9 more)

### Community 57 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.07
Nodes (25): Tab, TabbedPageClient(), FutureUpdatesContent(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS (+17 more)

### Community 60 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 61 - "PageContainer.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

### Community 62 - "available-features/route.ts"
Cohesion: 0.53
Nodes (4): GET(), AVAILABLE_FEATURES, AvailableFeature, featureStatus

### Community 63 - "colorContrast.ts"
Cohesion: 0.31
Nodes (9): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), contrastFindings(), homepageFindings(), imageResolutionFindings(), productPageFindings() (+1 more)

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "rules.ts"
Cohesion: 0.10
Nodes (18): RuleContext, RuleFinding, Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, hardcodedStorefrontTextRule (+10 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 72 - "AddThemeModal.tsx"
Cohesion: 0.19
Nodes (9): DemoStorePreset, PresetLinksEditor(), Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, Modal() (+1 more)

## Knowledge Gaps
- **426 isolated node(s):** `LiveCheckResult`, `MultiPresetLiveCheckResult`, `MEDIUM_VIEWPORT`, `ContrastSample`, `ImageSample` (+421 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `oauth.ts`, `executeAuditRun.ts`, `[id]/export/google-sheet/route.ts`, `diffFindings.ts`, `enhancement-point.ts`, `[id]/export/route.ts`, `finding.ts`, `reports/[id]/route.ts`, `seed-rules.ts`, `audit-run.ts`, `available-features/route.ts`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `next`, `react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `package.json`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `PageContainer()` connect `PageContainer.tsx` to `ThemeDetailTabs.tsx`, `insights/page.tsx`, `themes/page.tsx`, `app/page.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `LiveCheckResult`, `MultiPresetLiveCheckResult`, `MEDIUM_VIEWPORT` to the rest of the system?**
  _426 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._