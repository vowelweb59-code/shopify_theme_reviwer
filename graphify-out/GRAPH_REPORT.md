# Graph Report - Shopify Theme Auditor  (2026-09-17)

## Corpus Check
- 225 files · ~1,555,438 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1168 nodes · 2294 edges · 74 communities (67 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ecf249a9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- diffFindings.ts
- devDependencies
- dependencies
- compilerOptions
- types.ts
- [id]/export/google-sheet/route.ts
- connectToDatabase
- layout.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- getPageLabel
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- requirement.ts
- extractReadmeVersion.ts
- bugs/index.ts
- liveCheck.ts
- cross-file/index.ts
- pageSpeed.ts
- internal/index.ts
- Shopify Theme Auditor
- [id]/export/route.ts
- finding.ts
- enhancement-point.ts
- registry.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- executeAuditRun.ts
- theme.ts
- audit/page.tsx
- liquidJson.ts
- enhancementSheetFormatting.ts
- scripts
- seed-native-capabilities.ts
- deriveChecksForAuditRun.ts
- package.json
- enhancementSheetRows.ts
- themes/route.ts
- sheetRows.ts
- aggregate-release-notes.mjs
- sheetsFormatting.ts
- harvest-release-notes.mjs
- diff.tsx
- rules.ts
- buildTestTheme.ts
- proxy.ts
- ReportContent.tsx
- FutureUpdatesContent.tsx
- categoryDashboard.tsx
- insights/page.tsx
- templateComposition.ts
- available-features/page.tsx
- findingHistory.ts
- accessibility/index.test.ts
- enhancementReport.tsx
- shopify/index.ts
- executeAuditRun
- projectStatus.ts
- extractCssStructure.ts
- available-features/route.ts
- eslint-config-next
- react

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 67 edges
2. `isValidObjectId()` - 18 edges
3. `executeAuditRun()` - 18 edges
4. `buildTestTheme()` - 18 edges
5. `invalidIdResponse()` - 17 edges
6. `compilerOptions` - 16 edges
7. `parseJsonFile()` - 14 edges
8. `getPageLabel()` - 14 edges
9. `POST()` - 14 edges
10. `Rule` - 13 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (74 total, 7 thin omitted)

### Community 0 - "diffFindings.ts"
Cohesion: 0.22
Nodes (14): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffStatus, FindingsDiff (+6 more)

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, devDependencies, eslint, tailwindcss, @tailwindcss/postcss, tsx, @types/node, @types/react (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (21): exceljs, googleapis, htmlparser2, mongodb, mongoose, next, dependencies, exceljs (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.21
Nodes (21): POST(), POST(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, SheetEnhancementPoint, SheetTab, getAuthorizedClient() (+13 more)

### Community 6 - "connectToDatabase"
Cohesion: 0.23
Nodes (14): GET(), GET(), PATCH(), GET(), GET(), GET(), GET(), invalidIdResponse() (+6 more)

### Community 7 - "layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, NAV_LINKS

### Community 9 - "reports/page.tsx"
Cohesion: 0.67
Nodes (3): AuditRunRow, formatDate(), ReportsPage()

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.10
Nodes (20): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+12 more)

### Community 13 - "getPageLabel"
Cohesion: 0.12
Nodes (16): CoverageResult, BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField() (+8 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (16): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys() (+8 more)

### Community 19 - "requirement.ts"
Cohesion: 0.07
Nodes (32): CheckStatus, GET(), GET(), GET(), RequirementImplementationType, computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage() (+24 more)

### Community 20 - "extractReadmeVersion.ts"
Cohesion: 0.14
Nodes (18): parseThemeZip(), countThemeDirectories(), InvalidThemeError, resolveThemeRoot(), THEME_DIRECTORIES, ExtractedTheme, extractEntries(), extractThemeZip() (+10 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "liveCheck.ts"
Cohesion: 0.06
Nodes (48): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), collectFocusIndicatorSamples(), comparePresets(), contrastFindings() (+40 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.07
Nodes (24): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, brokenAriaReferenceRule, composedArticleSchemaRule (+16 more)

### Community 24 - "pageSpeed.ts"
Cohesion: 0.09
Nodes (32): formatDate(), formatScore(), PageSpeedContent(), ThemePageSpeedRow, findFirstProductLink(), PresetLiveCheckError, averageDefined(), collectPlaywrightMetrics() (+24 more)

### Community 25 - "internal/index.ts"
Cohesion: 0.16
Nodes (9): headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES, repetitiveSectionAxisRule, sectionTopicText(), settingTextValues(), TemplateJson, TemplateSection (+1 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "[id]/export/route.ts"
Cohesion: 0.11
Nodes (26): CONTENT_TYPES, Format, FORMATS, GET(), GET(), GET(), PATCH(), computeCoverage() (+18 more)

### Community 29 - "finding.ts"
Cohesion: 0.11
Nodes (18): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), demoStorePresetSchema, diagnosticsSchema, enhancementDetectionSchema (+10 more)

### Community 30 - "enhancement-point.ts"
Cohesion: 0.13
Nodes (14): GET(), PATCH(), AdoptionTier, AuditSettings, AuditSettingsDoc, auditSettingsSchema, ENHANCEMENT_SOURCES, ENHANCEMENT_STATUSES (+6 more)

### Community 31 - "registry.ts"
Cohesion: 0.23
Nodes (12): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary, summarizeFindings() (+4 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.21
Nodes (14): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), extractJsImports(), parseOneFile(), parseThemeDirectory(), ThemeParseResult, ThemeParseTiming (+6 more)

### Community 35 - "oauth.ts"
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "executeAuditRun.ts"
Cohesion: 0.10
Nodes (18): detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics(), ENHANCEMENT_DETECTORS, EnhancementDetector (+10 more)

### Community 37 - "theme.ts"
Cohesion: 0.13
Nodes (22): POST(), sha256(), localUploadSource(), ThemeSource, readmeErrorMessage(), uploadThemeVersion(), UploadVersionResult, deleteZip() (+14 more)

### Community 38 - "audit/page.tsx"
Cohesion: 0.22
Nodes (7): AuditRunResult, DemoStorePreset, PresetLiveCheckError, AuditDiagnostics, DiagnosticsNote(), FindingSummary, SummaryBar()

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "enhancementSheetFormatting.ts"
Cohesion: 0.15
Nodes (15): buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS, HEADER_BACKGROUND, HEADER_TEXT, RGB (+7 more)

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 43 - "seed-native-capabilities.ts"
Cohesion: 0.16
Nodes (14): tierForPercentage(), ENHANCEMENT_CATEGORIES, EnhancementPoint, NATIVE_CAPABILITY_COMPLETENESS, Category, COPY, main(), TrendData (+6 more)

### Community 44 - "deriveChecksForAuditRun.ts"
Cohesion: 0.07
Nodes (26): SeverityBadge(), DemoStorePreset, PresetLinksEditor(), CheckTotals, formatDate(), ThemeCard(), ThemeRow, AllChecksList() (+18 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "enhancementSheetRows.ts"
Cohesion: 0.20
Nodes (11): buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetFutureUpdatesPoint (+3 more)

### Community 47 - "themes/route.ts"
Cohesion: 0.28
Nodes (12): GET(), POST(), GET(), PATCH(), compareVersions(), ParsedVersion, parseVersionForSort(), pickLatestVersion() (+4 more)

### Community 48 - "sheetRows.ts"
Cohesion: 0.13
Nodes (20): DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX (+12 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "sheetsFormatting.ts"
Cohesion: 0.12
Nodes (13): SheetFormattingRequest, buildSheetFormattingRequests(), CATEGORY_TAB_COLORS, COLUMN_WIDTHS, HEADER_BACKGROUND, HEADER_TEXT, RESOLVED_COLUMN_INDEX, RGB (+5 more)

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "diff.tsx"
Cohesion: 0.12
Nodes (15): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+7 more)

### Community 53 - "rules.ts"
Cohesion: 0.11
Nodes (17): findSkippedHeadingLevels(), FindingCategory, Rule, RuleContext, RuleFinding, Severity, imageDimensionsRule, PERFORMANCE_RULES (+9 more)

### Community 54 - "buildTestTheme.ts"
Cohesion: 0.25
Nodes (10): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, SHOPIFY_SETTINGS_RULES (+2 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "ReportContent.tsx"
Cohesion: 0.15
Nodes (12): CoverageSummary, CoverageSummaryBar(), EngineVersionsNote(), FindingStatus, ReadinessPanel(), ReadinessSummary, RequirementInfo, TimingNote() (+4 more)

### Community 57 - "FutureUpdatesContent.tsx"
Cohesion: 0.21
Nodes (11): EnhancementPoint, Example, SOURCE_LABELS, STATUS_LABELS, STATUSES, TIER_STYLES, ADOPTION_TIERS, TIER_BLURBS (+3 more)

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "insights/page.tsx"
Cohesion: 0.09
Nodes (20): Tab, TabbedPageClient(), FutureUpdatesContent(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS (+12 more)

### Community 60 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 61 - "available-features/page.tsx"
Cohesion: 0.29
Nodes (6): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures

### Community 62 - "findingHistory.ts"
Cohesion: 0.29
Nodes (8): CarriedFinding, classifyFindingHistory(), HistoricalState, HistoryClassification, DiffableFinding, exactSignature(), locationSignature(), normalizeMessage()

### Community 64 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 65 - "shopify/index.ts"
Cohesion: 0.16
Nodes (11): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+3 more)

### Community 66 - "executeAuditRun"
Cohesion: 0.38
Nodes (6): parseDemoStorePresets(), POST(), POST(), captureRuleVersionSnapshot(), executeAuditRun(), loadThemeFindingHistory()

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 71 - "available-features/route.ts"
Cohesion: 0.53
Nodes (4): GET(), AVAILABLE_FEATURES, AvailableFeature, featureStatus

## Knowledge Gaps
- **414 isolated node(s):** `Tab`, `geistSans`, `geistMono`, `metadata`, `NAV_LINKS` (+409 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `diffFindings.ts`, `executeAuditRun`, `oauth.ts`, `[id]/export/google-sheet/route.ts`, `theme.ts`, `available-features/route.ts`, `seed-native-capabilities.ts`, `themes/route.ts`, `requirement.ts`, `[id]/export/route.ts`, `enhancement-point.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `FINDING_CATEGORIES` connect `requirement.ts` to `connectToDatabase`, `deriveChecksForAuditRun.ts`, `sheetRows.ts`, `rules.ts`, `finding.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `ReportContent.tsx`, `findings.tsx`, `executeAuditRun.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `executeAuditRun()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`executeAuditRun()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Tab`, `geistSans`, `geistMono` to the rest of the system?**
  _414 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._