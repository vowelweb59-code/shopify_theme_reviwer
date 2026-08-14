# Graph Report - Shopify Theme Auditor  (2026-08-14)

## Corpus Check
- 89 files · ~57,413 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 473 nodes · 779 edges · 28 communities (24 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59d317d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- scripts
- compilerOptions
- types.ts
- theme-parser/index.ts
- buildTestTheme.ts
- layout.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- accessibility/index.ts
- rules.ts
- registry.ts
- runRules.ts
- cross-file/index.ts
- technical-aeo/index.ts
- themeIndex.ts
- Shopify Theme Auditor

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 19 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 14 edges
4. `Rule` - 12 edges
5. `buildLineIndex()` - 11 edges
6. `scripts` - 9 edges
7. `buildTestTheme()` - 8 edges
8. `extractLiquidStructure()` - 8 edges
9. `parseOneFile()` - 8 edges
10. `composeTemplate()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `POST()` --calls--> `runAuditRules()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/audit/index.ts
- `POST()` --calls--> `parseThemeZip()`  [EXTRACTED]
  app/api/audit/run/route.ts → lib/theme-parser/index.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (28 total, 4 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.05
Nodes (51): GET(), GET(), POST(), GET(), GET(), GET(), GET(), AuditDiagnostics (+43 more)

### Community 1 - "devDependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+15 more)

### Community 2 - "scripts"
Cohesion: 0.07
Nodes (27): htmlparser2, mongoose, next, dependencies, htmlparser2, mongoose, next, postcss (+19 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.06
Nodes (49): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure (+41 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.09
Nodes (29): CSS_NAMED_COLORS, looksLikeColorValue(), COLOR_PROPERTIES, extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory() (+21 more)

### Community 6 - "buildTestTheme.ts"
Cohesion: 0.21
Nodes (8): RuleFinding, basenameNoExt(), buildThemeIndex(), ThemeIndex, CROSS_FILE_RULES, BASE_LAYOUT, buildTestTheme(), ThemeParseResult

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
Cohesion: 0.23
Nodes (11): AuditRunResult, AuditDiagnostics, DiagnosticsNote(), FindingRow, FindingsTable(), FindingSummary, SEVERITY_STYLES, SummaryBar() (+3 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.17
Nodes (17): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine() (+9 more)

### Community 19 - "accessibility/index.ts"
Cohesion: 0.12
Nodes (15): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ACCESSIBILITY_RULES, BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule (+7 more)

### Community 20 - "rules.ts"
Cohesion: 0.17
Nodes (12): Rule, RuleContext, Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule (+4 more)

### Community 21 - "registry.ts"
Cohesion: 0.15
Nodes (8): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule, INTERNAL_RULES, SHOPIFY_RULES

### Community 22 - "runRules.ts"
Cohesion: 0.26
Nodes (10): loadEnabledRules(), runAuditRules(), FindingCategory, dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding, runRules(), RunRulesResult (+2 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.06
Nodes (36): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+28 more)

### Community 24 - "technical-aeo/index.ts"
Cohesion: 0.22
Nodes (4): articleSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES

### Community 25 - "themeIndex.ts"
Cohesion: 0.39
Nodes (5): getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), headingMatchesSectionNameRule

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

## Knowledge Gaps
- **192 isolated node(s):** `BASE_LAYOUT`, `name`, `version`, `private`, `dev` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rule` connect `rules.ts` to `settings.ts`, `accessibility/index.ts`, `registry.ts`, `runRules.ts`, `cross-file/index.ts`, `technical-aeo/index.ts`, `themeIndex.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `parseJsonFile()` connect `parseJsonFile.ts` to `theme-parser/index.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `BASE_LAYOUT`, `name`, `version` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connectToDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.054987212276214836 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._