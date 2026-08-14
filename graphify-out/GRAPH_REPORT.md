# Graph Report - Shopify Theme Auditor  (2026-08-14)

## Corpus Check
- 79 files · ~50,948 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 455 nodes · 728 edges · 27 communities (23 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `292fdcd9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- theme-parser/index.ts
- rules.ts
- layout.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- registry.ts
- accessibility/index.ts
- shopify/index.ts
- bugs/index.ts
- runRules.ts
- cross-file/index.ts
- technical-aeo/index.ts
- themeIndex.ts
- Shopify Theme Auditor

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 19 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 13 edges
4. `Rule` - 12 edges
5. `buildLineIndex()` - 11 edges
6. `extractLiquidStructure()` - 8 edges
7. `parseOneFile()` - 8 edges
8. `scripts` - 7 edges
9. `Shopify Theme Auditor` - 7 edges
10. `include` - 7 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/findings/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/audit/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/[id]/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/reports/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (27 total, 4 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.05
Nodes (51): GET(), GET(), POST(), GET(), GET(), GET(), GET(), AuditDiagnostics (+43 more)

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.08
Nodes (25): htmlparser2, mongoose, next, dependencies, htmlparser2, mongoose, next, postcss (+17 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.06
Nodes (53): CSS_NAMED_COLORS, looksLikeColorValue(), DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, COLOR_PROPERTIES (+45 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.07
Nodes (43): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), extractJsImports(), parseOneFile() (+35 more)

### Community 6 - "rules.ts"
Cohesion: 0.40
Nodes (4): FindingCategory, RuleContext, RuleFinding, ThemeIndex

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

### Community 17 - "registry.ts"
Cohesion: 0.21
Nodes (9): findMultipleH1(), Rule, headingMatchesSectionNameRule, INTERNAL_RULES, imageDimensionsRule, multipleH1Rule, renderBlockingScriptRule, skippedHeadingSeoRule (+1 more)

### Community 19 - "accessibility/index.ts"
Cohesion: 0.12
Nodes (15): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ACCESSIBILITY_RULES, BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule (+7 more)

### Community 20 - "shopify/index.ts"
Cohesion: 0.15
Nodes (11): Severity, CHECKS, PresenceCheck, SHOPIFY_FEATURE_RULES, contentForHeaderRule, noRobotsTemplateRule, noSassRule, seoMetadataSnippetRule (+3 more)

### Community 21 - "bugs/index.ts"
Cohesion: 0.18
Nodes (6): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 22 - "runRules.ts"
Cohesion: 0.29
Nodes (9): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding, runRules(), RunRulesResult, RunRulesSummary (+1 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.07
Nodes (31): ComposedHeading, ComposedHeadingIssue, findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets(), ComposedTemplate (+23 more)

### Community 24 - "technical-aeo/index.ts"
Cohesion: 0.25
Nodes (4): articleSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES

### Community 25 - "themeIndex.ts"
Cohesion: 0.43
Nodes (6): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString()

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

## Knowledge Gaps
- **189 isolated node(s):** `ComposedTemplate`, `missingSectionRule`, `missingSnippetRule`, `missingTemplateSectionRule`, `missingAssetRule` (+184 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rule` connect `registry.ts` to `rules.ts`, `settings.ts`, `accessibility/index.ts`, `shopify/index.ts`, `bugs/index.ts`, `runRules.ts`, `cross-file/index.ts`, `technical-aeo/index.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `ComposedTemplate`, `missingSectionRule`, `missingSnippetRule` to the rest of the system?**
  _189 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connectToDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.054987212276214836 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05628415300546448 - nodes in this community are weakly interconnected._