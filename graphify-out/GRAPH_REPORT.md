# Graph Report - Shopify Theme Auditor  (2026-09-16)

## Corpus Check
- 190 files · ~1,545,777 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1046 nodes · 2002 edges · 68 communities (62 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a0e93d0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- isValidObjectId
- devDependencies
- dependencies
- compilerOptions
- types.ts
- enhancementSheetFormatting.ts
- audit-run.ts
- layout.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- settings/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- connectToDatabase
- zip.ts
- bugs/index.ts
- liveCheck.ts
- cross-file/index.ts
- pageSpeed.ts
- internal/index.ts
- Shopify Theme Auditor
- getPageLabel
- finding.ts
- seed-rules.ts
- runRules.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- run/route.ts
- extractCssStructure.ts
- audit/page.tsx
- liquidJson.ts
- diff/route.ts
- scripts
- maintenance/page.tsx
- enhancement-point.ts
- accessibility/index.ts
- package.json
- [id]/export/google-sheet/route.ts
- @types/node
- sheetRows.ts
- aggregate-release-notes.mjs
- templateComposition.ts
- harvest-release-notes.mjs
- diff.tsx
- rules.ts
- buildTestTheme.ts
- proxy.ts
- [id]/page.tsx
- readiness.ts
- categoryDashboard.tsx
- enhancementReport.tsx
- technical-seo/index.ts
- available-features/page.tsx
- accessibility/index.test.ts
- [id]/export/route.ts
- shopify/index.ts
- colorContrast.ts
- projectStatus.ts
- homepageFindings

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 55 edges
2. `isValidObjectId()` - 18 edges
3. `buildTestTheme()` - 18 edges
4. `invalidIdResponse()` - 17 edges
5. `POST()` - 16 edges
6. `compilerOptions` - 16 edges
7. `parseJsonFile()` - 14 edges
8. `getPageLabel()` - 14 edges
9. `POST()` - 14 edges
10. `Rule` - 13 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/enhancements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/page-speed/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (68 total, 6 thin omitted)

### Community 0 - "isValidObjectId"
Cohesion: 0.40
Nodes (7): GET(), GET(), PATCH(), GET(), invalidIdResponse(), isValidObjectId(), Finding

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.10
Nodes (21): exceljs, googleapis, htmlparser2, mongoose, next, dependencies, exceljs, googleapis (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, isLiquidExpression(), StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton (+16 more)

### Community 5 - "enhancementSheetFormatting.ts"
Cohesion: 0.08
Nodes (42): POST(), buildEnhancementSheetTabs(), buildFutureUpdatesRow(), buildFutureUpdatesTab(), buildRow(), DETECTED_LABELS, ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS (+34 more)

### Community 6 - "audit-run.ts"
Cohesion: 0.08
Nodes (27): GET(), GET(), GET(), AVAILABLE_FEATURES, AvailableFeature, featureStatus, AUDIT_RUN_STATUSES, AuditRun (+19 more)

### Community 7 - "layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, NAV_LINKS

### Community 8 - "rules/page.tsx"
Cohesion: 0.40
Nodes (3): Requirement, RULE_STATUS_LABELS, SOURCE_TYPE_LABELS

### Community 9 - "reports/page.tsx"
Cohesion: 0.67
Nodes (3): AuditRunRow, formatDate(), ReportsPage()

### Community 10 - "settings.ts"
Cohesion: 0.11
Nodes (16): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+8 more)

### Community 11 - "findings.tsx"
Cohesion: 0.10
Nodes (20): CATEGORIES, EngineVersions, FindingsTable(), formatMs(), PageSpeedPanel(), READINESS_LABEL, READINESS_STYLES, ReadinessStatus (+12 more)

### Community 13 - "settings/page.tsx"
Cohesion: 0.33
Nodes (3): GoogleStatus, ReadinessConfig, SEVERITIES

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 19 - "connectToDatabase"
Cohesion: 0.10
Nodes (27): GET(), GET(), GET(), GET(), GET(), PATCH(), connectToDatabase(), globalForMongoose (+19 more)

### Community 20 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "liveCheck.ts"
Cohesion: 0.13
Nodes (22): checkResponsiveReachability(), collectFocusIndicatorSamples(), comparePresets(), ContrastSample, evaluateReachabilityInPage(), extractLoadedPageFacts(), extractPageFacts(), findAndClickMenuTriggerInPage() (+14 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (18): brokenAriaReferenceRule, composedArticleSchemaRule, composedH1MissingRule, composedMultipleH1Rule, composedProductSchemaRule, composedSkippedHeadingRule, CROSS_FILE_RULES, duplicateLocaleKeyRule (+10 more)

### Community 24 - "pageSpeed.ts"
Cohesion: 0.09
Nodes (32): formatDate(), formatScore(), PageSpeedPage(), ThemePageSpeedRow, findFirstProductLink(), PresetLink, PresetLiveCheckError, averageDefined() (+24 more)

### Community 25 - "internal/index.ts"
Cohesion: 0.16
Nodes (9): headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES, repetitiveSectionAxisRule, sectionTopicText(), settingTextValues(), TemplateJson, TemplateSection (+1 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.15
Nodes (12): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+4 more)

### Community 28 - "getPageLabel"
Cohesion: 0.10
Nodes (20): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildDiffCsv() (+12 more)

### Community 29 - "finding.ts"
Cohesion: 0.23
Nodes (9): FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_SEVERITIES, FINDING_STATUSES, FindingDoc, findingSchema, ReadinessConfigDoc, ReadinessConfigModel (+1 more)

### Community 30 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 31 - "runRules.ts"
Cohesion: 0.18
Nodes (14): CheckStatus, GET(), loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding (+6 more)

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.18
Nodes (17): extractCssStructure(), extractHtmlStructure(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags(), emptyParsedFile() (+9 more)

### Community 35 - "oauth.ts"
Cohesion: 0.21
Nodes (12): GET(), POST(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl(), requireEnv() (+4 more)

### Community 36 - "run/route.ts"
Cohesion: 0.11
Nodes (20): captureRuleVersionSnapshot(), detectEnhancementsForRun(), extractSourceSnippet(), loadThemeFindingHistory(), parseDemoStorePresets(), POST(), toFindingDocs(), detectEnhancementPoints() (+12 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.29
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 38 - "audit/page.tsx"
Cohesion: 0.22
Nodes (7): AuditRunResult, DemoStorePreset, PresetLiveCheckError, AuditDiagnostics, DiagnosticsNote(), FindingSummary, SummaryBar()

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "diff/route.ts"
Cohesion: 0.42
Nodes (7): GET(), toPlainRecord(), attributeNewFindings(), computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), summarizeDiffByCategory(), summarizeDiffBySeverity()

### Community 41 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, harvest:trends, lint, seed:enhancements, seed:native-capabilities, seed:requirements (+4 more)

### Community 42 - "maintenance/page.tsx"
Cohesion: 0.33
Nodes (3): MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL

### Community 43 - "enhancement-point.ts"
Cohesion: 0.07
Nodes (36): GET(), PATCH(), EnhancementPoint, Example, SOURCE_LABELS, STATUS_LABELS, STATUSES, TIER_STYLES (+28 more)

### Community 44 - "accessibility/index.ts"
Cohesion: 0.10
Nodes (16): ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule, COLOR_LIKE_PROPS, colorContrastRule, cssOrderRule, focusOrderRule (+8 more)

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 46 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.48
Nodes (5): POST(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, withFutureUpdatesFormatting()

### Community 48 - "sheetRows.ts"
Cohesion: 0.05
Nodes (48): CategoryDiffSummary, DiffFinding, DiffStatus, FindingsDiff, FindingsDiffSummary, NewFindingAttribution, SEVERITY_ORDER, SeverityDiffSummary (+40 more)

### Community 49 - "aggregate-release-notes.mjs"
Cohesion: 0.22
Nodes (6): byTier, payload, points, themes, ENHANCEMENT_CATEGORIES, TOPICS

### Community 50 - "templateComposition.ts"
Cohesion: 0.44
Nodes (7): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName()

### Community 51 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 52 - "diff.tsx"
Cohesion: 0.12
Nodes (16): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+8 more)

### Community 53 - "rules.ts"
Cohesion: 0.18
Nodes (10): Rule, RuleContext, RuleFinding, Severity, imageDimensionsRule, PERFORMANCE_RULES, renderBlockingScriptRule, CHECKS (+2 more)

### Community 54 - "buildTestTheme.ts"
Cohesion: 0.18
Nodes (13): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, SHOPIFY_SETTINGS_RULES (+5 more)

### Community 55 - "proxy.ts"
Cohesion: 0.60
Nodes (4): config, proxy(), timingSafeStringEqual(), UNAUTHORIZED()

### Community 56 - "[id]/page.tsx"
Cohesion: 0.17
Nodes (12): CoverageSummary, CoverageSummaryBar(), EngineVersionsNote(), FindingStatus, ReadinessPanel(), ReadinessSummary, RequirementInfo, TimingNote() (+4 more)

### Community 57 - "readiness.ts"
Cohesion: 0.19
Nodes (10): CoverageResult, computeReadiness(), DEFAULT_READINESS_CONFIG, isUnresolved(), ReadinessConfig, ReadinessFinding, ReadinessResult, ReadinessStatus (+2 more)

### Community 58 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 59 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 60 - "technical-seo/index.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

### Community 61 - "available-features/page.tsx"
Cohesion: 0.29
Nodes (6): AvailableFeaturesPage(), FeatureRow, formatDate(), STATUS_CLASS, STATUS_LABEL, ThemeFeatures

### Community 64 - "[id]/export/route.ts"
Cohesion: 0.35
Nodes (9): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), loadReadinessConfig() (+1 more)

### Community 65 - "shopify/index.ts"
Cohesion: 0.16
Nodes (11): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+3 more)

### Community 66 - "colorContrast.ts"
Cohesion: 0.53
Nodes (5): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), contrastFindings()

### Community 68 - "projectStatus.ts"
Cohesion: 0.33
Nodes (4): PhaseEntry, PhaseStatus, PROJECT_PHASES, STATUS_WEIGHT

### Community 69 - "homepageFindings"
Cohesion: 0.67
Nodes (4): homepageFindings(), imageResolutionFindings(), productPageFindings(), touchTargetFindings()

## Knowledge Gaps
- **390 isolated node(s):** `BASE_LAYOUT`, `MongooseCache`, `SchemaNameContext`, `SchemaSettingsContext`, `EngineVersions` (+385 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `isValidObjectId`, `[id]/export/route.ts`, `oauth.ts`, `run/route.ts`, `enhancementSheetFormatting.ts`, `audit-run.ts`, `diff/route.ts`, `enhancement-point.ts`, `[id]/export/google-sheet/route.ts`, `finding.ts`, `seed-rules.ts`, `runRules.ts`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`, `@types/node`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `PageSpeedMetric` connect `pageSpeed.ts` to `[id]/page.tsx`, `findings.tsx`, `run/route.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `POST()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`POST()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `BASE_LAYOUT`, `MongooseCache`, `SchemaNameContext` to the rest of the system?**
  _390 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._