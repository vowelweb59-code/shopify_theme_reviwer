# Graph Report - Shopify Theme Auditor  (2026-09-17)

## Corpus Check
- 242 files · ~1,561,287 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1246 nodes · 2482 edges · 76 communities (70 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `859f4c3b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- deriveChecksForAuditRun.ts
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
- connectToDatabase
- [id]/export/route.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- requirement.ts
- extractReadmeVersion.ts
- bugs/index.ts
- isValidObjectId
- cross-file/index.ts
- liveCheck.ts
- internal/index.ts
- Shopify Theme Auditor
- accessibility/index.ts
- theme.ts
- finding.ts
- runRules.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- technical-seo/index.ts
- buildTestTheme.ts
- liquidJson.ts
- enhancementSheetFormatting.ts
- scripts
- enhancement-point.ts
- OverviewPanel.tsx
- package.json
- enhancementSheetRows.ts
- [themeId]/route.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- getPageLabel
- themes/page.tsx
- proxy.ts
- ReportContent.tsx
- readiness.ts
- categoryDashboard.tsx
- insights/page.tsx
- audit-run.ts
- PageContainer.tsx
- computeScoreboard.ts
- Button.tsx
- enhancementReport.tsx
- shopify/index.ts
- extractCssStructure.ts
- projectStatus.ts
- buildLineIndex
- audit-settings.ts
- AddThemeModal.tsx
- htmlparser2
- next
- @radix-ui/react-dropdown-menu

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 69 edges
2. `isValidObjectId()` - 18 edges
3. `buildTestTheme()` - 18 edges
4. `executeAuditRun()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `parseJsonFile()` - 14 edges
8. `POST()` - 14 edges
9. `getPageLabel()` - 14 edges
10. `AuditRun` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (76 total, 6 thin omitted)

### Community 0 - "deriveChecksForAuditRun.ts"
Cohesion: 0.15
Nodes (12): CheckStatusValue, STATUS_CONFIG, StatusBadge(), AllChecksList(), matchesSearch(), STATUS_FILTERS, baseArgs, CategoryChecks (+4 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (22): exceljs, googleapis, lucide-react, mongodb, mongoose, dependencies, exceljs, googleapis (+14 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.30
Nodes (16): POST(), POST(), getAuthorizedClient(), columnLetter(), createGoogleSheet(), getSpreadsheetSheetsList(), GoogleSheetsNotConnectedError, GoogleSheetSpreadsheetNotFoundError (+8 more)

### Community 6 - "rules.ts"
Cohesion: 0.13
Nodes (13): FindingCategory, Rule, RuleContext, RuleFinding, Severity, CROSS_FILE_RULES, BASE_LAYOUT, imageDimensionsRule (+5 more)

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
Nodes (22): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessPanel() (+14 more)

### Community 12 - "connectToDatabase"
Cohesion: 0.19
Nodes (15): parseDemoStorePresets(), POST(), GET(), GET(), GET(), GET(), GET(), GET() (+7 more)

### Community 13 - "[id]/export/route.ts"
Cohesion: 0.25
Nodes (11): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), buildEnhancementReportForRun() (+3 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.28
Nodes (11): extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys(), isLocaleFilePath(), isSectionGroupPath(), isSettingsSchemaPath(), isTemplateJsonPath() (+3 more)

### Community 19 - "requirement.ts"
Cohesion: 0.09
Nodes (27): GET(), GET(), RequirementImplementationType, computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), FINDING_CATEGORIES, Requirement (+19 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.11
Nodes (22): countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, ExtractedTheme, extractEntries(), extractThemeZip(), MAX_FILE_COUNT (+14 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "isValidObjectId"
Cohesion: 0.40
Nodes (7): GET(), GET(), PATCH(), GET(), invalidIdResponse(), isValidObjectId(), Finding

### Community 23 - "cross-file/index.ts"
Cohesion: 0.09
Nodes (23): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName(), brokenAriaReferenceRule (+15 more)

### Community 24 - "liveCheck.ts"
Cohesion: 0.06
Nodes (61): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), collectFocusIndicatorSamples(), comparePresets(), contrastFindings() (+53 more)

### Community 25 - "internal/index.ts"
Cohesion: 0.16
Nodes (9): headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES, repetitiveSectionAxisRule, sectionTopicText(), settingTextValues(), TemplateJson, TemplateSection (+1 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "accessibility/index.ts"
Cohesion: 0.07
Nodes (17): ACCESSIBILITY_RULES, ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule, COLOR_LIKE_PROPS, colorContrastRule, cssOrderRule (+9 more)

### Community 29 - "theme.ts"
Cohesion: 0.12
Nodes (23): POST(), POST(), sha256(), localUploadSource(), ThemeSource, uploadThemeVersion(), UploadVersionResult, versionErrorMessage() (+15 more)

### Community 30 - "finding.ts"
Cohesion: 0.18
Nodes (13): GET(), PATCH(), loadReadinessConfig(), cascadeDeleteFindings(), FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_SEVERITIES, FINDING_STATUSES (+5 more)

### Community 31 - "runRules.ts"
Cohesion: 0.15
Nodes (16): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding, runRules() (+8 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

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
Cohesion: 0.06
Nodes (43): GET(), toPlainRecord(), detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics() (+35 more)

### Community 37 - "technical-seo/index.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

### Community 38 - "buildTestTheme.ts"
Cohesion: 0.25
Nodes (10): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, SHOPIFY_SETTINGS_RULES (+2 more)

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
Cohesion: 0.17
Nodes (10): Card(), CardHeader(), CheckTotals, formatDate(), healthTone(), OverviewPanel(), Props, ScoreboardGrid() (+2 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "enhancementSheetRows.ts"
Cohesion: 0.16
Nodes (13): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetEnhancementPoint (+5 more)

### Community 47 - "[themeId]/route.ts"
Cohesion: 0.31
Nodes (9): GET(), PATCH(), compareVersions(), ParsedVersion, parseVersionForSort(), pickLatestVersion(), DemoStorePreset, MAX_PRESETS (+1 more)

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
Nodes (16): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+8 more)

### Community 53 - "getPageLabel"
Cohesion: 0.10
Nodes (20): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildDiffCsv() (+12 more)

### Community 54 - "themes/page.tsx"
Cohesion: 0.15
Nodes (17): EmptyState(), ResponsiveTable(), TableColumn, Dashboard(), DashboardData, formatDate(), healthTone(), CheckTotals (+9 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "ReportContent.tsx"
Cohesion: 0.13
Nodes (15): AuditDiagnostics, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersionsNote(), FindingStatus, FindingSummary, ReadinessSummary (+7 more)

### Community 57 - "readiness.ts"
Cohesion: 0.19
Nodes (10): CoverageResult, computeReadiness(), DEFAULT_READINESS_CONFIG, isUnresolved(), ReadinessConfig, ReadinessFinding, ReadinessResult, ReadinessStatus (+2 more)

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.07
Nodes (24): Tab, TabbedPageClient(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES (+16 more)

### Community 60 - "audit-run.ts"
Cohesion: 0.15
Nodes (12): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, demoStorePresetSchema, diagnosticsSchema, enhancementDetectionSchema, fileErrorSchema (+4 more)

### Community 61 - "PageContainer.tsx"
Cohesion: 0.17
Nodes (10): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures, PageContainer(), AuditRunRow (+2 more)

### Community 62 - "computeScoreboard.ts"
Cohesion: 0.33
Nodes (9): AVAILABLE_FEATURES, AvailableFeature, featureStatus, averageDefined(), categoryScore(), computeScoreboard(), featuresScoreCard(), opportunitiesScoreCard() (+1 more)

### Community 63 - "Button.tsx"
Cohesion: 0.20
Nodes (10): Button, ButtonSize, ButtonVariant, SIZE_CLASSES, VARIANT_CLASSES, AuditTotals, formatDate(), VersionRow (+2 more)

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

### Community 69 - "buildLineIndex"
Cohesion: 0.31
Nodes (6): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), ParsedJsImport

### Community 71 - "audit-settings.ts"
Cohesion: 0.50
Nodes (3): AuditSettings, AuditSettingsDoc, auditSettingsSchema

### Community 72 - "AddThemeModal.tsx"
Cohesion: 0.36
Nodes (4): DemoStorePreset, PresetLinksEditor(), Modal(), AddThemeModal()

## Knowledge Gaps
- **428 isolated node(s):** `AuditRunDetail`, `AuditRunListItem`, `STATUS_FILTERS`, `CheckTotals`, `Props` (+423 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `oauth.ts`, `executeAuditRun.ts`, `[id]/export/google-sheet/route.ts`, `enhancement-point.ts`, `[id]/export/route.ts`, `[themeId]/route.ts`, `requirement.ts`, `isValidObjectId`, `theme.ts`, `finding.ts`, `runRules.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `FINDING_CATEGORIES` connect `requirement.ts` to `deriveChecksForAuditRun.ts`, `rules.ts`, `connectToDatabase`, `sheetRows.ts`, `finding.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `htmlparser2`, `next`, `@radix-ui/react-dropdown-menu`, `package.json`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AuditRunDetail`, `AuditRunListItem`, `STATUS_FILTERS` to the rest of the system?**
  _428 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `deriveChecksForAuditRun.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._