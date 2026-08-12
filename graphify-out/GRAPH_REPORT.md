# Graph Report - Shopify Theme Auditor  (2026-08-12)

## Corpus Check
- 78 files · ~48,768 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 439 nodes · 693 edges · 23 communities (19 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `103b166e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connectToDatabase
- devDependencies
- dependencies
- compilerOptions
- types.ts
- theme-parser/index.ts
- parseJsonFile.ts
- layout.tsx
- rules/page.tsx
- reports/page.tsx
- settings.ts
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- accessibility/index.ts
- rules.ts
- runRules.ts
- cross-file/index.ts
- Shopify Theme Auditor

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 19 edges
2. `compilerOptions` - 16 edges
3. `Rule` - 12 edges
4. `parseJsonFile()` - 12 edges
5. `buildLineIndex()` - 9 edges
6. `extractLiquidStructure()` - 8 edges
7. `parseOneFile()` - 7 edges
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

## Communities (23 total, 4 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.05
Nodes (52): GET(), GET(), POST(), GET(), GET(), GET(), GET(), AuditDiagnostics (+44 more)

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
Nodes (54): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, extractHtmlStructure() (+46 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.10
Nodes (24): CSS_NAMED_COLORS, looksLikeColorValue(), COLOR_PROPERTIES, extractCssStructure(), parseThemeDirectory(), ThemeParseResult, FileType, ParsedCssInfo (+16 more)

### Community 6 - "parseJsonFile.ts"
Cohesion: 0.23
Nodes (14): DuplicateJsonKey, findDuplicateJsonKeys(), Frame, buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences(), findLine(), flattenLocaleKeys() (+6 more)

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

### Community 19 - "accessibility/index.ts"
Cohesion: 0.14
Nodes (14): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule, focusOrderRule (+6 more)

### Community 20 - "rules.ts"
Cohesion: 0.07
Nodes (27): Rule, RuleContext, Severity, ACCESSIBILITY_RULES, BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, missingScopedSettingRule (+19 more)

### Community 22 - "runRules.ts"
Cohesion: 0.16
Nodes (16): loadEnabledRules(), runAuditRules(), FindingCategory, RuleFinding, dedupeKey(), EMPTY_SUMMARY(), ExecutedFinding, runRules() (+8 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.07
Nodes (31): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, collectRenderedSnippets() (+23 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

## Knowledge Gaps
- **186 isolated node(s):** `HeadingIssue`, `ComposedHeadingIssue`, `ComposedTemplate`, `missingSectionRule`, `missingSnippetRule` (+181 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rule` connect `rules.ts` to `settings.ts`, `accessibility/index.ts`, `runRules.ts`, `cross-file/index.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `parseJsonFile()` connect `parseJsonFile.ts` to `types.ts`, `theme-parser/index.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `HeadingIssue`, `ComposedHeadingIssue`, `ComposedTemplate` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connectToDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.054244306418219465 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._