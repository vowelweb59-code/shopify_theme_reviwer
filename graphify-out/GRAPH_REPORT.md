# Graph Report - Shopify Theme Auditor  (2026-09-25)

## Corpus Check
- 381 files · ~1,631,493 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2445 nodes · 5014 edges · 133 communities (125 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `10004e51`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- runSync.ts
- devDependencies
- dependencies
- compilerOptions
- types.ts
- [id]/export/google-sheet/route.ts
- buildTestTheme.ts
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
- available-features/page.tsx
- cross-file/index.ts
- [id]/export/route.ts
- internal/index.ts
- Shopify Theme Auditor
- accessibility/index.ts
- finding.ts
- runFilteredRankingCheck.ts
- featureStatus
- rules.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- metrics.ts
- executeAuditRun.ts
- shopify/index.ts
- Phase 4 — Advanced Static Analysis & Audit Quality
- runRules.ts
- Theme
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- seed-rules.ts
- OverviewContent.tsx
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
- getPageLabel
- PageContainer.tsx
- themeStoreFeatures.ts
- Ga4ThemesSection.tsx
- enhancementReport.tsx
- enhancementSheetRows.ts
- extractCssStructure.ts
- projectStatus.ts
- googleConnections.ts
- accessibility/index.test.ts
- oauth.ts
- BreakdownTable.tsx
- themes.ts
- GA4 Analytics — Architecture
- metrics.integration.test.ts
- ranking/page.tsx
- connectToDatabase
- Phase 5 — Audit Results, Reporting & Export
- audit/route.ts
- [themeId]/route.ts
- runLiveChecks.ts
- dateRanges.ts
- uniqueUsers.ts
- params.ts
- Phase 7 — Submission Readiness, Rule Coverage & Maintenance
- diffFindings.ts
- Phase 2 — Shopify Theme Parser
- AddThemeModal.tsx
- headingChecks.ts
- Phase 8 — Testing, Security, Performance & Deployment
- findingHistory.ts
- ParsedFile
- Shopify Theme Store Approval Audit — Project Rules & Parameters
- fetchPageFacts.ts
- Phase 1 — Shopify Requirements & Standards Knowledge Base
- liquidJson.ts
- mongoose
- react
- Phase 0 — Foundation & MongoDB Scaffolding
- Phase 6 — Re-Audit, Diff & Finding Lifecycle
- phase-3-static-rules-updated.md
- BreakdownSection.tsx
- AnalyticsShell.tsx
- 29. Final product acceptance test
- Scope
- psiAccessibilityFindings.ts
- Scope
- 23. Comparison tests
- Trends.tsx
- csv.ts
- Phase 0 — Scaffolding
- 15. False-positive prevention
- 5. Accessibility Rules
- Phase 3 — Shopify Theme Store Compliance & Static Rules Engine
- 7. Diff states
- 13. Error handling
- 13. Severity model
- 16. Rule testing
- 6. Technical SEO Rules
- 7. Technical AEO / Structured Data Rules
- 17. Diff UI
- 6. Matching algorithm
- 22. Exporting diffs
- 2. Test levels
- 3. Shopify Section & Schema Rules
- 20. Deployment architecture
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 137 edges
2. `isValidObjectId()` - 40 edges
3. `invalidIdResponse()` - 33 edges
4. `Phase 8 — Testing, Security, Performance & Deployment` - 32 edges
5. `Phase 7 — Submission Readiness, Rule Coverage & Maintenance` - 31 edges
6. `Phase 2 — Shopify Theme Parser` - 29 edges
7. `Phase 6 — Re-Audit, Diff & Finding Lifecycle` - 27 edges
8. `Shopify Theme Store Approval Audit — Project Rules & Parameters` - 26 edges
9. `Phase 4 — Advanced Static Analysis & Audit Quality` - 26 edges
10. `Phase 5 — Audit Results, Reporting & Export` - 24 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/demo-store/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (133 total, 8 thin omitted)

### Community 0 - "runSync.ts"
Cohesion: 0.07
Nodes (50): GET(), addDays(), chunkDateRange(), dateInTimeZone(), formatInZone(), fromGa4Date(), maxDate(), minDate() (+42 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

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
Cohesion: 0.28
Nodes (17): POST(), POST(), getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError, GoogleSheetSpreadsheetNotFoundError (+9 more)

### Community 6 - "buildTestTheme.ts"
Cohesion: 0.13
Nodes (11): RuleFinding, CROSS_FILE_RULES, BASE_LAYOUT, INTERNAL_RULES, SHOPIFY_SETTINGS_RULES, TECHNICAL_SEO_RULES, buildTestTheme(), BASE_LAYOUT (+3 more)

### Community 7 - "AppShell.tsx"
Cohesion: 0.21
Nodes (9): AppShell(), isActive(), MobileNav(), NAV_ITEMS, isActive(), Sidebar(), geistMono, geistSans (+1 more)

### Community 9 - "ThemeDetailTabs.tsx"
Cohesion: 0.15
Nodes (12): DownloadReportDropdown(), FileFormat, Format, FORMAT_LABELS, CheckTotals, ThemeDetail, ThemeDetailTabs(), AuditTotals (+4 more)

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.07
Nodes (37): AuditDiagnostics, CATEGORIES, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersions, EngineVersionsNote(), FindingsTable() (+29 more)

### Community 12 - "pageSpeed.ts"
Cohesion: 0.11
Nodes (27): formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow, averageDefined(), discoverPageUrls(), extractCoreMetrics(), extractOpportunityFindings() (+19 more)

### Community 13 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 18 - "demo-store/page.tsx"
Cohesion: 0.13
Nodes (19): DemoStoreData, DemoStorePage(), DemoStoreRecord, FilteredRankingData, FilteredRankRow, flattenRankRows(), formatDateTime(), INDUSTRIES (+11 more)

### Community 19 - "requirement.ts"
Cohesion: 0.11
Nodes (20): GET(), GET(), RequirementImplementationType, GET(), FINDING_CATEGORIES, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc (+12 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.18
Nodes (14): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, extractThemeVersionFromZip(), extractVersionFromReadmeText(), extractVersionFromSettingsSchema(), findReadmeFile() (+6 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "available-features/page.tsx"
Cohesion: 0.29
Nodes (6): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures

### Community 23 - "cross-file/index.ts"
Cohesion: 0.09
Nodes (24): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName(), brokenAriaReferenceRule (+16 more)

### Community 24 - "[id]/export/route.ts"
Cohesion: 0.11
Nodes (28): GET(), CONTENT_TYPES, Format, FORMATS, GET(), GET(), GET(), PATCH() (+20 more)

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
Cohesion: 0.07
Nodes (27): GET(), GET(), AUDIT_RUN_STATUSES, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), demoStorePresetSchema, diagnosticsSchema (+19 more)

### Community 30 - "runFilteredRankingCheck.ts"
Cohesion: 0.12
Nodes (20): currentRows(), GET(), parseQuery(), POST(), buildListingUrl(), CatalogFilter, CatalogRankResult, extractCatalogCards() (+12 more)

### Community 31 - "featureStatus"
Cohesion: 0.31
Nodes (6): EnhancementDetection, FeatureMatrixRow, FeatureMatrixTable(), AVAILABLE_FEATURES, AvailableFeature, featureStatus

### Community 32 - "rules.ts"
Cohesion: 0.13
Nodes (12): Rule, RuleContext, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule (+4 more)

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.13
Nodes (21): extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags(), emptyParsedFile() (+13 more)

### Community 35 - "metrics.ts"
Cohesion: 0.06
Nodes (77): resolvePeriod(), filterMatch(), sumsAcrossRows(), assemble(), Compared, compareDeep(), compareKpis(), compareValues() (+69 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.13
Nodes (16): AuditDiagnostics, computeAuditDiagnostics(), captureRuleVersionSnapshot(), executeAuditRun(), ExecuteAuditRunHooks, ExecuteAuditRunParams, ExecuteAuditRunResult, extractSourceSnippet() (+8 more)

### Community 37 - "shopify/index.ts"
Cohesion: 0.11
Nodes (15): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput() (+7 more)

### Community 38 - "Phase 4 — Advanced Static Analysis & Audit Quality"
Cohesion: 0.04
Nodes (44): 10. Duplicate and conflict detection, 11. Cross-file JavaScript analysis, 12. Accessibility cross-file analysis, 13. CSS accessibility analysis, 14. Performance structure analysis, 15. Rule confidence, 16. False-positive controls, 17. Audit diagnostics (+36 more)

### Community 39 - "runRules.ts"
Cohesion: 0.20
Nodes (13): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), runRules() (+5 more)

### Community 40 - "Theme"
Cohesion: 0.11
Nodes (22): parseDemoStorePresets(), POST(), POST(), GET(), GET(), POST(), globalForScheduler, randomNextDelayMs() (+14 more)

### Community 41 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, harvest:trends, lint, seed:analytics-themes, seed:enhancements, seed:native-capabilities (+5 more)

### Community 43 - "enhancement-point.ts"
Cohesion: 0.07
Nodes (35): GET(), PATCH(), EnhancementPoint, Example, SOURCE_LABELS, STATUS_LABELS, STATUSES, TIER_STYLES (+27 more)

### Community 44 - "OverviewPanel.tsx"
Cohesion: 0.10
Nodes (21): CheckTotals, CoreWebVitalsTable(), formatDate(), formatMs(), healthTone(), isDesktopPerformanceFinding(), OverviewPanel(), Props (+13 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 47 - "OverviewContent.tsx"
Cohesion: 0.11
Nodes (29): AnalyticsShell(), DataNotes(), DataWarnings(), EventsContent(), compact, formatCount(), formatDateTime(), formatPercent() (+21 more)

### Community 48 - "sheetRows.ts"
Cohesion: 0.14
Nodes (19): DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX, FINDING_COLUMN_INDEX (+11 more)

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
Cohesion: 0.33
Nodes (6): config, isCrossSiteMutation(), MUTATING_METHODS, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "AllChecksList.tsx"
Cohesion: 0.27
Nodes (7): SeverityBadge(), CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList(), matchesSearch(), STATUS_FILTERS

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.17
Nodes (9): FutureUpdatesContent(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES, SOURCE_TYPE_LABELS (+1 more)

### Community 60 - "getPageLabel"
Cohesion: 0.14
Nodes (15): CoverageResult, BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildReportHtml(), escapeHtml(), PdfFindingRow, PdfSummary (+7 more)

### Community 61 - "PageContainer.tsx"
Cohesion: 0.29
Nodes (4): PageContainer(), AuditRunRow, formatDate(), ReportsPage()

### Community 62 - "themeStoreFeatures.ts"
Cohesion: 0.08
Nodes (33): POST(), GET(), register(), checkPendingThemeStoreListings(), LISTING_RECHECK_MS, fetchLiveDemoStoreTheme(), LiveThemeResult, runDemoStoreCheck() (+25 more)

### Community 63 - "Ga4ThemesSection.tsx"
Cohesion: 0.12
Nodes (25): Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, Banner, BANNER_CLASSES, bannerFromParams() (+17 more)

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "enhancementSheetRows.ts"
Cohesion: 0.16
Nodes (13): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetEnhancementPoint (+5 more)

### Community 66 - "extractCssStructure.ts"
Cohesion: 0.28
Nodes (7): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, extractCssStructure(), ParsedCssInfo, ParsedParseError

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "googleConnections.ts"
Cohesion: 0.08
Nodes (40): GET(), OAUTH_ERROR_MESSAGES, GET(), GET(), decryptSecret(), encryptSecret(), getEncryptionKey(), key (+32 more)

### Community 72 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 73 - "BreakdownTable.tsx"
Cohesion: 0.12
Nodes (25): BreakdownTable(), Column, FilterAction(), PARAM_FOR_DIM, rowFilters(), rowLabel(), dimsOf(), EVENT_LABELS (+17 more)

### Community 74 - "themes.ts"
Cohesion: 0.08
Nodes (44): GET(), POST(), markConnectionRevoked(), AdminApi, createAdminApi(), Ga4PropertyDetails, Ga4PropertyError, Ga4PropertySummary (+36 more)

### Community 75 - "GA4 Analytics — Architecture"
Cohesion: 0.06
Nodes (32): 1. The existing application (audit findings), 2. GA4 architecture, 3.1 `AnalyticsTheme` (`models/analytics-theme.ts`), 3.2 `GoogleConnection` (`models/google-connection.ts`), 3.3 `AnalyticsSync` (`models/analytics-sync.ts`), 3.4 `AnalyticsAggregate` (`models/analytics-aggregate.ts`), 3. Database design, 4. Analytics correctness constraints (binding on Phases 4–7) (+24 more)

### Community 77 - "metrics.integration.test.ts"
Cohesion: 0.07
Nodes (40): AGGREGATE_BREAKDOWNS, AGGREGATE_DIMENSIONS, AggregateBreakdown, AggregateDimension, ALL_EVENTS, buildDimsKey(), GA4_DATE_PATTERN, GA4_PROPERTY_ID_PATTERN (+32 more)

### Community 78 - "ranking/page.tsx"
Cohesion: 0.23
Nodes (8): BreadcrumbItem, Breadcrumbs(), ChartSeries, LineChart(), nearestIndex(), PAD, SERIES_VARS, HistoryData

### Community 79 - "connectToDatabase"
Cohesion: 0.19
Nodes (21): POST(), GET(), POST(), POST(), PATCH(), POST(), GET(), POST() (+13 more)

### Community 80 - "Phase 5 — Audit Results, Reporting & Export"
Cohesion: 0.04
Nodes (44): 10. Category dashboards, 11. Audit diagnostics, 12. Search, 13. Export formats, 14. Optional Google Sheets integration, 15. Report generation model, 16. Report snapshots, 17. Rule/version information (+36 more)

### Community 81 - "audit/route.ts"
Cohesion: 0.14
Nodes (19): POST(), sha256(), localUploadSource(), ThemeSource, uploadThemeVersion(), UploadVersionResult, versionErrorMessage(), deleteZip() (+11 more)

### Community 82 - "[themeId]/route.ts"
Cohesion: 0.15
Nodes (22): GET(), GET(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, compareVersions(), ParsedVersion, parseVersionForSort() (+14 more)

### Community 83 - "runLiveChecks.ts"
Cohesion: 0.16
Nodes (15): PageFacts, comparePresets(), PresetFacts, MultiPresetLiveCheckResult, PresetCheckOutcome, runChecksForPreset(), runLiveChecksForPresets(), { fetchPageFactsMock } (+7 more)

### Community 84 - "dateRanges.ts"
Cohesion: 0.20
Nodes (15): DATE_RANGE_PRESETS, DateRange, DateRangeError, DateRangeSpec, datesInRange(), daysBetween(), isRealDate(), MAX_RANGE_DAYS (+7 more)

### Community 85 - "uniqueUsers.ts"
Cohesion: 0.08
Nodes (31): buildUniqueUsersRequests(), CachedDoc, CachedGroup, cacheKeyFor(), fetchUniqueUsers(), filterExpression(), fromCache(), getUniqueUsers() (+23 more)

### Community 86 - "params.ts"
Cohesion: 0.17
Nodes (18): GET(), GET(), GET(), GET(), GET(), GET(), isFilterParam(), BREAKDOWN_SORTS (+10 more)

### Community 87 - "Phase 7 — Submission Readiness, Rule Coverage & Maintenance"
Cohesion: 0.05
Nodes (38): 10. Partial rules, 11. Rule inventory, 12. Rule versioning, 13. Requirement versioning, 14. Requirement review workflow, 15. Rule review metadata, 16. Rule test coverage, 17. Critical rule classification (+30 more)

### Community 88 - "diffFindings.ts"
Cohesion: 0.15
Nodes (17): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+9 more)

### Community 89 - "Phase 2 — Shopify Theme Parser"
Cohesion: 0.05
Nodes (37): 10. Translation and localization extraction, 11. Scripts and performance-related structures, 12. Stylesheets and CSS, 13. Liquid references, 14. Deprecated Shopify references, 15. Asset and file references, 16. JSON templates and configuration, 17. Locale files (+29 more)

### Community 90 - "AddThemeModal.tsx"
Cohesion: 0.19
Nodes (9): POST(), PATCH(), DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal(), DemoStorePreset, MAX_PRESETS (+1 more)

### Community 91 - "headingChecks.ts"
Cohesion: 0.18
Nodes (11): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+3 more)

### Community 92 - "Phase 8 — Testing, Security, Performance & Deployment"
Cohesion: 0.07
Nodes (28): 10. API authorization boundary, 11. File privacy, 12. Audit data retention, 14. Audit observability, 15. Performance optimization, 16. Audit execution strategy, 17. MongoDB indexes and query performance, 18. Frontend performance (+20 more)

### Community 93 - "findingHistory.ts"
Cohesion: 0.33
Nodes (7): CarriedFinding, classifyFindingHistory(), HistoricalState, HistoryClassification, DiffableFinding, exactSignature(), normalizeMessage()

### Community 94 - "ParsedFile"
Cohesion: 0.29
Nodes (8): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), ENHANCEMENT_DETECTORS, EnhancementDetector, detectEnhancementsForRun(), ParsedFile

### Community 95 - "Shopify Theme Store Approval Audit — Project Rules & Parameters"
Cohesion: 0.07
Nodes (26): 10. FUNCTIONAL UNIQUENESS TEST, 11. CUSTOMER UX, 12. MERCHANT UX, 13. ACCESSIBILITY, 14. PERFORMANCE, 15. MOBILE, 16. SHOPIFY TECHNICAL REQUIREMENTS, 17. REJECTION SIMULATION (+18 more)

### Community 96 - "fetchPageFacts.ts"
Cohesion: 0.62
Nodes (5): extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts(), isAbortError()

### Community 97 - "Phase 1 — Shopify Requirements & Standards Knowledge Base"
Cohesion: 0.08
Nodes (25): 1. Primary source: Shopify Theme Store requirements, 2. Internal theme standards, 3. Technical best practices, Acceptance criteria, Accessibility, Audit scope definitions, Bugs, Explicitly out of scope (+17 more)

### Community 98 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 102 - "Phase 0 — Foundation & MongoDB Scaffolding"
Cohesion: 0.09
Nodes (22): Acceptance criteria, Application stack, Audit lifecycle, `audit_runs`, `audit_settings`, Database model, Explicitly out of scope, `findings` (+14 more)

### Community 103 - "Phase 6 — Re-Audit, Diff & Finding Lifecycle"
Cohesion: 0.09
Nodes (22): 10. Finding lifecycle, 11. Manual finding status, 12. Ignored findings, 13. Reintroduced findings, 14. Rule changes between audits, 15. Requirement changes, 16. Diff API, 18. Before/after source comparison (+14 more)

### Community 104 - "phase-3-static-rules-updated.md"
Cohesion: 0.12
Nodes (15): 10. Theme Configuration Rules, 11. JavaScript / Code Integrity Rules, 12. Internal Standards Rules, 14. Source traceability, 17. Real-theme validation, 18. Rule coverage, 19. Rule performance, 1. Shopify Theme Structure & Package Rules (+7 more)

### Community 105 - "BreakdownSection.tsx"
Cohesion: 0.21
Nodes (4): BreakdownSection(), Card(), CardHeader(), BreakdownSort

### Community 106 - "AnalyticsShell.tsx"
Cohesion: 0.19
Nodes (10): ANALYTICS_SECTIONS, DashboardControls(), ThemeOption, FilterBar(), DashboardParams, EmptyState(), ErrorState(), DATE_RANGE_LABELS (+2 more)

### Community 107 - "29. Final product acceptance test"
Cohesion: 0.17
Nodes (12): 29. Final product acceptance test, Step 1, Step 10, Step 11, Step 2, Step 3, Step 4, Step 5 (+4 more)

### Community 108 - "Scope"
Cohesion: 0.18
Nodes (10): Acceptance criteria, Chunking, Embedding, Explicitly out of scope, Ingestion inputs (all four, not a subset), Phase 1 — Knowledge Base Ingestion, Retrieval function (build now, used later), Scope (+2 more)

### Community 109 - "psiAccessibilityFindings.ts"
Cohesion: 0.44
Nodes (6): cleanExplanation(), contrastFindingsFromPsi(), nodeOf(), touchTargetFindingsFromPsi(), LighthouseResult, item()

### Community 110 - "Scope"
Cohesion: 0.22
Nodes (8): Acceptance criteria, Explicitly out of scope, File walking, Input handling, Liquid parsing — be realistic about this, Output shape, Phase 2 — Theme Parser, Scope

### Community 111 - "23. Comparison tests"
Cohesion: 0.22
Nodes (9): 23. Comparison tests, Changed finding, File rename, Moved line, New finding, Persistent finding, Reintroduced finding, Resolved finding (+1 more)

### Community 112 - "Trends.tsx"
Cohesion: 0.32
Nodes (7): dateToMs(), formatCompact(), Basis, METRICS, Trends(), valueOf(), TrendsResponse

### Community 113 - "csv.ts"
Cohesion: 0.39
Nodes (4): buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField()

### Community 114 - "Phase 0 — Scaffolding"
Cohesion: 0.29
Nodes (6): Acceptance criteria, Database schema (create as migrations, not ad-hoc SQL), Explicitly out of scope for this phase, Folder structure to establish, Phase 0 — Scaffolding, Scope

### Community 115 - "15. False-positive prevention"
Cohesion: 0.29
Nodes (7): 15. False-positive prevention, Conditional markup, Decorative images, Dynamic content, Optional Shopify structures, Reusable sections, Translation strings

### Community 116 - "5. Accessibility Rules"
Cohesion: 0.29
Nodes (7): 5. Accessibility Rules, Contrast, Forms, HTML language, Images, Interactive elements, SVG and icons

### Community 117 - "Phase 3 — Shopify Theme Store Compliance & Static Rules Engine"
Cohesion: 0.33
Nodes (6): Core principle, Phase 3 — Shopify Theme Store Compliance & Static Rules Engine, Rule classification, Rule execution, Rule priority, Rule shape

### Community 118 - "7. Diff states"
Cohesion: 0.33
Nodes (6): 7. Diff states, Changed, New, Resolved, Still present, Unchanged

### Community 119 - "13. Error handling"
Cohesion: 0.33
Nodes (6): 13. Error handling, Database error, Diff error, Export error, Parser error, Rule error

### Community 120 - "13. Severity model"
Cohesion: 0.40
Nodes (5): 13. Severity model, Blocker, High, Low, Medium

### Community 121 - "16. Rule testing"
Cohesion: 0.40
Nodes (5): 16. Rule testing, Dynamic case, Edge case, Positive failure case, Positive pass case

### Community 122 - "6. Technical SEO Rules"
Cohesion: 0.40
Nodes (5): 6. Technical SEO Rules, Explicitly excluded SEO checks, Heading rules, Images, Metadata rules

### Community 123 - "7. Technical AEO / Structured Data Rules"
Cohesion: 0.40
Nodes (5): 7. Technical AEO / Structured Data Rules, Article schema, JSON-LD validity, Organization schema, Product schema

### Community 124 - "17. Diff UI"
Cohesion: 0.40
Nodes (5): 17. Diff UI, New finding, Resolved finding, Still present, Tabs

### Community 125 - "6. Matching algorithm"
Cohesion: 0.40
Nodes (5): 6. Matching algorithm, Stage 1 — Exact signature, Stage 2 — Stable rule/location match, Stage 3 — Source-context match, Stage 4 — Unmatched

### Community 126 - "22. Exporting diffs"
Cohesion: 0.50
Nodes (4): 22. Exporting diffs, CSV, JSON, XLSX

### Community 127 - "2. Test levels"
Cohesion: 0.50
Nodes (4): 2. Test levels, End-to-end tests, Integration tests, Unit tests

### Community 128 - "3. Shopify Section & Schema Rules"
Cohesion: 0.67
Nodes (3): 3. Shopify Section & Schema Rules, Schema validity, Section structure

### Community 129 - "20. Deployment architecture"
Cohesion: 0.67
Nodes (3): 20. Deployment architecture, Local development, Production

## Knowledge Gaps
- **987 isolated node(s):** `Tab`, `CATEGORY_ORDER`, `DiffFindingDetail`, `DiffFindingRow`, `ATTRIBUTION_LABEL` (+982 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `runSync.ts`, `[id]/export/google-sheet/route.ts`, `requirement.ts`, `[id]/export/route.ts`, `finding.ts`, `runFilteredRankingCheck.ts`, `runRules.ts`, `Theme`, `enhancement-point.ts`, `seed-rules.ts`, `themeStoreFeatures.ts`, `googleConnections.ts`, `oauth.ts`, `themes.ts`, `audit/route.ts`, `[themeId]/route.ts`, `params.ts`, `diffFindings.ts`, `AddThemeModal.tsx`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `isValidObjectId()` connect `connectToDatabase` to `metrics.ts`, `[id]/export/google-sheet/route.ts`, `googleConnections.ts`, `themes.ts`, `diffFindings.ts`, `[id]/export/route.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `executeAuditRun.ts`, `ThemeDetailTabs.tsx`, `findings.tsx`, `OverviewPanel.tsx`, `[themeId]/route.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `Tab`, `CATEGORY_ORDER`, `DiffFindingDetail` to the rest of the system?**
  _987 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `runSync.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07062146892655367 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._