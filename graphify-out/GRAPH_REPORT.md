# Graph Report - Shopify Theme Auditor  (2026-08-18)

## Corpus Check
- 153 files · ~1,486,238 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 772 nodes · 1453 edges · 43 communities (37 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `256b81bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- oauth.ts
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
- rules.ts
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
- rule.ts
- run/route.ts
- extractCssStructure.ts
- cross-file/index.test.ts
- liquidJson.ts
- zip.ts
- maintenance/page.tsx
- accessibility/index.test.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 42 edges
2. `isValidObjectId()` - 18 edges
3. `invalidIdResponse()` - 17 edges
4. `compilerOptions` - 16 edges
5. `getPageLabel()` - 14 edges
6. `parseJsonFile()` - 14 edges
7. `GET()` - 13 edges
8. `POST()` - 13 edges
9. `Rule` - 12 edges
10. `buildLineIndex()` - 11 edges

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

## Communities (43 total, 6 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.26
Nodes (14): GET(), GET(), PATCH(), GET(), POST(), GET(), invalidIdResponse(), isValidObjectId() (+6 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.06
Nodes (33): exceljs, googleapis, htmlparser2, mongoose, next, dependencies, exceljs, googleapis (+25 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "oauth.ts"
Cohesion: 0.07
Nodes (33): GET(), POST(), GET(), GET(), buildCategorySheetTabs(), buildRow(), SheetFindingRow, SheetTab (+25 more)

### Community 6 - "finding.ts"
Cohesion: 0.10
Nodes (20): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema, liveCheckErrorSchema (+12 more)

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
Nodes (16): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys() (+8 more)

### Community 19 - "requirement.ts"
Cohesion: 0.15
Nodes (16): CheckStatus, GET(), GET(), FINDING_CATEGORIES, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc (+8 more)

### Community 20 - "rules.ts"
Cohesion: 0.13
Nodes (16): FindingCategory, Rule, RuleContext, Severity, headingMatchesSectionNameRule, INTERNAL_RULES, CHECKS, PresenceCheck (+8 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.14
Nodes (8): RuleFinding, BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "accessibility/index.ts"
Cohesion: 0.08
Nodes (34): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+26 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (35): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+27 more)

### Community 24 - "runRules.ts"
Cohesion: 0.18
Nodes (16): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary, summarizeFindings() (+8 more)

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.16
Nodes (17): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), computeReadiness() (+9 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "getPageLabel"
Cohesion: 0.10
Nodes (21): CoverageResult, DiffFinding, BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow (+13 more)

### Community 29 - "readiness/route.ts"
Cohesion: 0.36
Nodes (7): GET(), PATCH(), loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel, readinessConfigSchema

### Community 30 - "seed-rules.ts"
Cohesion: 0.36
Nodes (5): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), main()

### Community 31 - "themeIndex.ts"
Cohesion: 0.50
Nodes (5): getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.15
Nodes (20): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), extractJsImports(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseResult (+12 more)

### Community 35 - "rule.ts"
Cohesion: 0.28
Nodes (6): GET(), GET(), Rule, RULE_CRITICALITIES, RuleDoc, ruleSchema

### Community 36 - "run/route.ts"
Cohesion: 0.07
Nodes (35): captureRuleVersionSnapshot(), extractSourceSnippet(), loadThemeFindingHistory(), POST(), toFindingDocs(), GET(), toPlainRecord(), AuditDiagnostics (+27 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 42 - "maintenance/page.tsx"
Cohesion: 0.33
Nodes (3): MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL

## Knowledge Gaps
- **285 isolated node(s):** `ReadinessStatus`, `SEVERITY_STYLES`, `STATUS_STYLES`, `READINESS_STYLES`, `READINESS_LABEL` (+280 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `rule.ts`, `run/route.ts`, `oauth.ts`, `requirement.ts`, `[id]/export/route.ts`, `readiness/route.ts`, `seed-rules.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `dependencies`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `ReadinessStatus`, `SEVERITY_STYLES`, `STATUS_STYLES` to the rest of the system?**
  _285 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1225071225071225 - nodes in this community are weakly interconnected._