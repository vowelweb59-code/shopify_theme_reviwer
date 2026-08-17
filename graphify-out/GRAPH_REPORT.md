# Graph Report - Shopify Theme Auditor  (2026-08-17)

## Corpus Check
- 125 files · ~1,477,816 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 663 nodes · 1180 edges · 35 communities (29 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c41a0709`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- dependencies
- compilerOptions
- types.ts
- runRules.ts
- connectToDatabase
- ProjectStatusWidget.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- rules.ts
- accessibility/index.ts
- cross-file/index.ts
- cross-file/index.test.ts
- [id]/export/route.ts
- Shopify Theme Auditor
- diffFindings.ts
- bugs/index.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- themeIndex.ts
- run/route.ts
- extractCssStructure.ts
- accessibility/index.test.ts
- liquidJson.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 27 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `POST()` - 11 edges
6. `buildLineIndex()` - 11 edges
7. `buildTestTheme()` - 11 edges
8. `GET()` - 10 edges
9. `computeFindingsDiff()` - 9 edges
10. `computeReadiness()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `runAuditRules()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/index.ts
- `POST()` --calls--> `runLiveChecks()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/liveCheck.ts
- `POST()` --calls--> `summarizeFindings()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/runRules.ts
- `POST()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/diff/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (35 total, 6 thin omitted)

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
Nodes (24): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+16 more)

### Community 5 - "runRules.ts"
Cohesion: 0.18
Nodes (16): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary, summarizeFindings() (+8 more)

### Community 6 - "connectToDatabase"
Cohesion: 0.05
Nodes (50): GET(), GET(), PATCH(), GET(), GET(), GET(), connectToDatabase(), globalForMongoose (+42 more)

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
Cohesion: 0.06
Nodes (49): AuditRunResult, CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), ATTRIBUTION_LABEL, CategoryDiffSummary (+41 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 21 - "rules.ts"
Cohesion: 0.13
Nodes (16): FindingCategory, Rule, RuleContext, Severity, headingMatchesSectionNameRule, INTERNAL_RULES, CHECKS, PresenceCheck (+8 more)

### Community 22 - "accessibility/index.ts"
Cohesion: 0.08
Nodes (34): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+26 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (36): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+28 more)

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.10
Nodes (27): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+19 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "diffFindings.ts"
Cohesion: 0.11
Nodes (24): GET(), GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffFinding (+16 more)

### Community 31 - "bugs/index.ts"
Cohesion: 0.14
Nodes (8): RuleFinding, BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.18
Nodes (16): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), ThemeParseResult, emptyMetaTags(), emptyParsedFile() (+8 more)

### Community 35 - "themeIndex.ts"
Cohesion: 0.50
Nodes (5): getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex

### Community 36 - "run/route.ts"
Cohesion: 0.11
Nodes (25): captureRuleVersionSnapshot(), extractSourceSnippet(), loadThemeFindingHistory(), POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), CarriedFinding (+17 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

### Community 39 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

## Knowledge Gaps
- **257 isolated node(s):** `DiffFindingDetail`, `DiffFindingRow`, `ATTRIBUTION_LABEL`, `CategoryDiffSummary`, `SeverityDiffSummary` (+252 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `[id]/export/route.ts`, `run/route.ts`, `diffFindings.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `computeReadiness()` connect `[id]/export/route.ts` to `findings.tsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `Rule` connect `rules.ts` to `technical-aeo/index.ts`, `runRules.ts`, `settings.ts`, `accessibility/index.ts`, `cross-file/index.ts`, `bugs/index.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `DiffFindingDetail`, `DiffFindingRow`, `ATTRIBUTION_LABEL` to the rest of the system?**
  _257 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._