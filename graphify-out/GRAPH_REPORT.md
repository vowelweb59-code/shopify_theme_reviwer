# Graph Report - Shopify Theme Auditor  (2026-08-18)

## Corpus Check
- 155 files · ~1,488,921 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 802 nodes · 1534 edges · 49 communities (42 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8e053dc1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- sheetRows.ts
- finding.ts
- ProjectStatusWidget.tsx
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
- requirement.ts
- shopify/index.ts
- bugs/index.ts
- accessibility/index.ts
- cross-file/index.ts
- runRules.ts
- [id]/export/route.ts
- Shopify Theme Auditor
- getPageLabel
- readiness/route.ts
- seed-rules.ts
- themeIndex.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- oauth.ts
- run/route.ts
- extractCssStructure.ts
- registry.ts
- liquidJson.ts
- zip.ts
- scripts
- maintenance/page.tsx
- buildTestTheme
- rules.ts
- package.json
- googleapis
- @types/node
- @types/yauzl

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 42 edges
2. `isValidObjectId()` - 18 edges
3. `invalidIdResponse()` - 17 edges
4. `compilerOptions` - 16 edges
5. `parseJsonFile()` - 14 edges
6. `getPageLabel()` - 14 edges
7. `GET()` - 13 edges
8. `POST()` - 13 edges
9. `Rule` - 12 edges
10. `POST()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/rules/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (49 total, 7 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.28
Nodes (12): GET(), GET(), PATCH(), GET(), GET(), invalidIdResponse(), isValidObjectId(), connectToDatabase() (+4 more)

### Community 1 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+11 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): exceljs, htmlparser2, mongoose, next, dependencies, exceljs, htmlparser2, mongoose (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, isLiquidExpression(), StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton (+16 more)

### Community 5 - "sheetRows.ts"
Cohesion: 0.07
Nodes (49): POST(), DiffFinding, mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs() (+41 more)

### Community 6 - "finding.ts"
Cohesion: 0.10
Nodes (21): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema, liveCheckErrorSchema (+13 more)

### Community 7 - "ProjectStatusWidget.tsx"
Cohesion: 0.15
Nodes (13): ProjectStatusWidget(), Requirement, STATUS_DOT, STATUS_LABEL, geistMono, geistSans, metadata, NAV_LINKS (+5 more)

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
Cohesion: 0.05
Nodes (54): AuditRunResult, CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), ATTRIBUTION_LABEL, CategoryDiffSummary (+46 more)

### Community 13 - "settings/page.tsx"
Cohesion: 0.33
Nodes (3): GoogleStatus, ReadinessConfig, SEVERITIES

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 19 - "requirement.ts"
Cohesion: 0.13
Nodes (18): CheckStatus, GET(), GET(), GET(), ALL_RULES, FINDING_CATEGORIES, Requirement, REQUIREMENT_SOURCE_TYPES (+10 more)

### Community 20 - "shopify/index.ts"
Cohesion: 0.15
Nodes (11): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+3 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.17
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "accessibility/index.ts"
Cohesion: 0.08
Nodes (33): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+25 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.07
Nodes (30): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+22 more)

### Community 24 - "runRules.ts"
Cohesion: 0.24
Nodes (11): loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding, runRules(), RunRulesResult (+3 more)

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.17
Nodes (17): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), computeReadiness() (+9 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "getPageLabel"
Cohesion: 0.10
Nodes (21): CoverageResult, BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField() (+13 more)

### Community 29 - "readiness/route.ts"
Cohesion: 0.33
Nodes (7): GET(), PATCH(), loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel, readinessConfigSchema

### Community 30 - "seed-rules.ts"
Cohesion: 0.18
Nodes (10): GET(), computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), Rule, RULE_CRITICALITIES, RuleDoc, ruleSchema (+2 more)

### Community 31 - "themeIndex.ts"
Cohesion: 0.35
Nodes (8): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, ThemeParseResult

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
Cohesion: 0.17
Nodes (14): GET(), POST(), GET(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleAuthUrl() (+6 more)

### Community 36 - "run/route.ts"
Cohesion: 0.08
Nodes (34): captureRuleVersionSnapshot(), extractSourceSnippet(), loadThemeFindingHistory(), POST(), toFindingDocs(), GET(), toPlainRecord(), AuditDiagnostics (+26 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.29
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 38 - "registry.ts"
Cohesion: 0.23
Nodes (8): Rule, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, multipleH1Rule, renderBlockingScriptRule, skippedHeadingSeoRule, TECHNICAL_SEO_RULES

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 41 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, seed:requirements, seed:rules, start, test (+1 more)

### Community 42 - "maintenance/page.tsx"
Cohesion: 0.33
Nodes (3): MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL

### Community 43 - "buildTestTheme"
Cohesion: 0.47
Nodes (4): buildTestTheme(), BASE_LAYOUT, FIXTURE_THEMES, runFixture()

### Community 44 - "rules.ts"
Cohesion: 0.16
Nodes (5): RuleContext, RuleFinding, ACCESSIBILITY_RULES, CROSS_FILE_RULES, BASE_LAYOUT

### Community 45 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

## Knowledge Gaps
- **300 isolated node(s):** `AuditRunDetail`, `AuditRunListItem`, `findingA`, `findingB`, `altText` (+295 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `oauth.ts`, `run/route.ts`, `sheetRows.ts`, `requirement.ts`, `[id]/export/route.ts`, `readiness/route.ts`, `seed-rules.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `@types/yauzl`, `package.json`, `@types/node`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `googleapis`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `AuditRunDetail`, `AuditRunListItem`, `findingA` to the rest of the system?**
  _300 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._