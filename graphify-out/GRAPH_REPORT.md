# Graph Report - Shopify Theme Auditor  (2026-08-17)

## Corpus Check
- 136 files · ~1,481,255 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 703 nodes · 1261 edges · 43 communities (38 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `745325e4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- runRules.ts
- audit-run.ts
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
- registry.ts
- shopify/index.ts
- liveCheck.ts
- cross-file/index.ts
- rule.ts
- [id]/export/route.ts
- Shopify Theme Auditor
- diffFindings.ts
- finding.ts
- seed-rules.ts
- bugs/index.ts
- rules.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- themeIndex.ts
- run/route.ts
- extractCssStructure.ts
- accessibility/index.ts
- liquidJson.ts
- zip.ts
- readiness/route.ts
- maintenance/page.tsx

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 32 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `POST()` - 13 edges
5. `Rule` - 12 edges
6. `buildLineIndex()` - 11 edges
7. `GET()` - 11 edges
8. `buildTestTheme()` - 11 edges
9. `computeReadiness()` - 9 edges
10. `computeFindingsDiff()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/rules/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `PATCH()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/findings/[id]/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `POST()` --calls--> `runAuditRules()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/index.ts

## Import Cycles
- None detected.

## Communities (43 total, 5 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.22
Nodes (10): GET(), GET(), GET(), GET(), GET(), PATCH(), connectToDatabase(), globalForMongoose (+2 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "dependencies"
Cohesion: 0.06
Nodes (31): exceljs, htmlparser2, mongoose, next, dependencies, exceljs, htmlparser2, mongoose (+23 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.12
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, isLiquidExpression(), StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton (+16 more)

### Community 5 - "runRules.ts"
Cohesion: 0.21
Nodes (13): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding, runRules(), RunRulesResult, RunRulesSummary (+5 more)

### Community 6 - "audit-run.ts"
Cohesion: 0.11
Nodes (16): AUDIT_RUN_STATUSES, AuditRunDoc, auditRunSchema, auditRunSummarySchema, cascadeDeleteFindings(), diagnosticsSchema, fileErrorSchema, liveCheckErrorSchema (+8 more)

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
Nodes (52): AuditRunResult, CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), ATTRIBUTION_LABEL, CategoryDiffSummary (+44 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 19 - "requirement.ts"
Cohesion: 0.17
Nodes (11): REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc, requirementSchema, RULE_STATUSES, Category, main(), requirements (+3 more)

### Community 20 - "registry.ts"
Cohesion: 0.21
Nodes (9): findSkippedHeadingLevels(), Rule, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, multipleH1Rule, renderBlockingScriptRule, skippedHeadingSeoRule (+1 more)

### Community 21 - "shopify/index.ts"
Cohesion: 0.15
Nodes (11): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+3 more)

### Community 22 - "liveCheck.ts"
Cohesion: 0.16
Nodes (21): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+13 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (30): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets(), ComposedTemplate (+22 more)

### Community 24 - "rule.ts"
Cohesion: 0.29
Nodes (6): GET(), FINDING_CATEGORIES, Rule, RULE_CRITICALITIES, RuleDoc, ruleSchema

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.10
Nodes (30): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+22 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "diffFindings.ts"
Cohesion: 0.11
Nodes (24): GET(), GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffFinding (+16 more)

### Community 29 - "finding.ts"
Cohesion: 0.24
Nodes (8): GET(), PATCH(), Finding, FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_STATUSES, FindingDoc, findingSchema

### Community 30 - "seed-rules.ts"
Cohesion: 0.36
Nodes (5): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), main()

### Community 31 - "bugs/index.ts"
Cohesion: 0.15
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 32 - "rules.ts"
Cohesion: 0.11
Nodes (12): FindingCategory, RuleContext, RuleFinding, CROSS_FILE_RULES, BASE_LAYOUT, articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule (+4 more)

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.18
Nodes (17): extractCssStructure(), extractHtmlStructure(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags(), emptyParsedFile() (+9 more)

### Community 35 - "themeIndex.ts"
Cohesion: 0.29
Nodes (10): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, buildTestTheme() (+2 more)

### Community 36 - "run/route.ts"
Cohesion: 0.13
Nodes (16): captureRuleVersionSnapshot(), extractSourceSnippet(), loadThemeFindingHistory(), POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), CarriedFinding (+8 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.29
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 38 - "accessibility/index.ts"
Cohesion: 0.10
Nodes (13): ACCESSIBILITY_RULES, ariaHiddenFocusableRule, BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule, focusOrderRule, formLabelRule, htmlLangRule (+5 more)

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 40 - "zip.ts"
Cohesion: 0.25
Nodes (8): ExtractedTheme, extractEntries(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath(), ThemeZipError

### Community 41 - "readiness/route.ts"
Cohesion: 0.47
Nodes (4): FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel, readinessConfigSchema

### Community 42 - "maintenance/page.tsx"
Cohesion: 0.33
Nodes (3): MaintenanceSummary, MatrixRow, RULE_STATUS_LABEL

## Knowledge Gaps
- **268 isolated node(s):** `ReadinessStatus`, `SEVERITY_STYLES`, `STATUS_STYLES`, `READINESS_STYLES`, `READINESS_LABEL` (+263 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `run/route.ts`, `readiness/route.ts`, `requirement.ts`, `rule.ts`, `[id]/export/route.ts`, `diffFindings.ts`, `finding.ts`, `seed-rules.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `computeReadiness()` connect `[id]/export/route.ts` to `findings.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `Rule` connect `registry.ts` to `rules.ts`, `runRules.ts`, `accessibility/index.ts`, `settings.ts`, `shopify/index.ts`, `cross-file/index.ts`, `bugs/index.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `POST()` (e.g. with `.record()` and `.toRecord()`) actually correct?**
  _`POST()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ReadinessStatus`, `SEVERITY_STYLES`, `STATUS_STYLES` to the rest of the system?**
  _268 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._