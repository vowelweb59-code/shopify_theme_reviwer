# Graph Report - Shopify Theme Auditor  (2026-08-17)

## Corpus Check
- 139 files · ~1,481,824 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 710 nodes · 1316 edges · 42 communities (37 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `25d21cfe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- rules.ts
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
- shopify/index.ts
- bugs/index.ts
- accessibility/index.ts
- cross-file/index.ts
- runRules.ts
- [id]/export/route.ts
- Shopify Theme Auditor
- diffFindings.ts
- finding.ts
- seed-rules.ts
- themeIndex.ts
- technical-aeo/index.ts
- extractLiquidStructure.ts
- theme-parser/index.ts
- buildTestTheme
- run/route.ts
- extractCssStructure.ts
- pdf.ts
- liquidJson.ts
- zip.ts
- maintenance/page.tsx

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 34 edges
2. `isValidObjectId()` - 16 edges
3. `compilerOptions` - 16 edges
4. `invalidIdResponse()` - 15 edges
5. `parseJsonFile()` - 14 edges
6. `GET()` - 13 edges
7. `POST()` - 13 edges
8. `Rule` - 12 edges
9. `buildLineIndex()` - 11 edges
10. `buildTestTheme()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `main()` --calls--> `connectToDatabase()`  [EXTRACTED]
  scripts/seed-requirements.ts → lib/db/connect.ts
- `GET()` --calls--> `computeFindingsDiff()`  [EXTRACTED]
  app/api/reports/[id]/diff/export/route.ts → lib/audit/diffFindings.ts
- `GET()` --calls--> `buildDiffCsv()`  [EXTRACTED]
  app/api/reports/[id]/diff/export/route.ts → lib/export/diffCsv.ts
- `GET()` --calls--> `invalidIdResponse()`  [EXTRACTED]
  app/api/reports/[id]/diff/route.ts → lib/api/validation.ts

## Import Cycles
- None detected.

## Communities (42 total, 5 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.18
Nodes (18): GET(), GET(), PATCH(), CheckStatus, GET(), GET(), GET(), GET() (+10 more)

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

### Community 5 - "rules.ts"
Cohesion: 0.18
Nodes (11): findSkippedHeadingLevels(), FindingCategory, Rule, RuleContext, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, multipleH1Rule (+3 more)

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
Cohesion: 0.13
Nodes (18): GET(), FINDING_CATEGORIES, Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RequirementDoc, requirementSchema, RULE_STATUSES (+10 more)

### Community 20 - "shopify/index.ts"
Cohesion: 0.15
Nodes (11): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+3 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.15
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "accessibility/index.ts"
Cohesion: 0.06
Nodes (35): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), checkResponsiveReachability(), contrastFindings(), ContrastSample, evaluateReachabilityInPage() (+27 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.08
Nodes (30): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets(), ComposedTemplate (+22 more)

### Community 24 - "runRules.ts"
Cohesion: 0.27
Nodes (11): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary, summarizeFindings() (+3 more)

### Community 25 - "[id]/export/route.ts"
Cohesion: 0.12
Nodes (24): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+16 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

### Community 28 - "diffFindings.ts"
Cohesion: 0.11
Nodes (23): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffFinding, DiffStatus (+15 more)

### Community 29 - "finding.ts"
Cohesion: 0.23
Nodes (9): FINDING_HISTORICAL_STATES, FINDING_LAYERS, FINDING_SEVERITIES, FINDING_STATUSES, FindingDoc, findingSchema, ReadinessConfigDoc, ReadinessConfigModel (+1 more)

### Community 30 - "seed-rules.ts"
Cohesion: 0.36
Nodes (5): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), main()

### Community 31 - "themeIndex.ts"
Cohesion: 0.36
Nodes (7): basenameNoExt(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, ThemeParseResult

### Community 32 - "technical-aeo/index.ts"
Cohesion: 0.15
Nodes (8): RuleFinding, articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 33 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 34 - "theme-parser/index.ts"
Cohesion: 0.18
Nodes (17): extractCssStructure(), extractHtmlStructure(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseTiming, emptyMetaTags(), emptyParsedFile() (+9 more)

### Community 35 - "buildTestTheme"
Cohesion: 0.24
Nodes (6): CROSS_FILE_RULES, BASE_LAYOUT, buildTestTheme(), BASE_LAYOUT, FIXTURE_THEMES, runFixture()

### Community 36 - "run/route.ts"
Cohesion: 0.13
Nodes (16): captureRuleVersionSnapshot(), extractSourceSnippet(), loadThemeFindingHistory(), POST(), toFindingDocs(), AuditDiagnostics, computeAuditDiagnostics(), CarriedFinding (+8 more)

### Community 37 - "extractCssStructure.ts"
Cohesion: 0.29
Nodes (6): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo, ParsedParseError

### Community 38 - "pdf.ts"
Cohesion: 0.38
Nodes (5): buildReportHtml(), escapeHtml(), PdfFindingRow, PdfSummary, SEVERITY_COLOR

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
- **267 isolated node(s):** `FORMATS`, `Format`, `CONTENT_TYPES`, `CheckStatus`, `MongooseCache` (+262 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `run/route.ts`, `requirement.ts`, `[id]/export/route.ts`, `diffFindings.ts`, `finding.ts`, `seed-rules.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `computeReadiness()` connect `[id]/export/route.ts` to `findings.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `Rule` connect `rules.ts` to `technical-aeo/index.ts`, `settings.ts`, `shopify/index.ts`, `bugs/index.ts`, `accessibility/index.ts`, `cross-file/index.ts`, `runRules.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `FORMATS`, `Format`, `CONTENT_TYPES` to the rest of the system?**
  _267 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._