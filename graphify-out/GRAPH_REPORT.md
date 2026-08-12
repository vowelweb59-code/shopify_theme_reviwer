# Graph Report - Shopify Theme Auditor  (2026-08-12)

## Corpus Check
- 74 files · ~38,280 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 371 nodes · 594 edges · 21 communities (17 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a465179`
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
- findings.tsx
- app/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- rules.ts
- accessibility/index.ts
- Shopify Theme Auditor

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 19 edges
2. `compilerOptions` - 16 edges
3. `parseJsonFile()` - 11 edges
4. `Rule` - 9 edges
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

## Communities (21 total, 4 thin omitted)

### Community 0 - "connectToDatabase"
Cohesion: 0.06
Nodes (49): GET(), GET(), POST(), GET(), GET(), GET(), GET(), loadEnabledRules() (+41 more)

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
Cohesion: 0.07
Nodes (45): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame (+37 more)

### Community 5 - "theme-parser/index.ts"
Cohesion: 0.09
Nodes (30): CSS_NAMED_COLORS, looksLikeColorValue(), COLOR_PROPERTIES, extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory() (+22 more)

### Community 6 - "parseJsonFile.ts"
Cohesion: 0.22
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

### Community 11 - "findings.tsx"
Cohesion: 0.24
Nodes (9): AuditRunResult, FindingRow, FindingsTable(), FindingSummary, SEVERITY_STYLES, SummaryBar(), AuditRunDetail, formatDate() (+1 more)

### Community 17 - "rules.ts"
Cohesion: 0.06
Nodes (47): findMultipleH1(), findSkippedHeadingLevels(), HeadingIssue, FindingCategory, Rule, RuleContext, RuleFinding, Severity (+39 more)

### Community 19 - "accessibility/index.ts"
Cohesion: 0.17
Nodes (13): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), BG_LIKE_PROPS, COLOR_LIKE_PROPS, colorContrastRule, focusOrderRule (+5 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.25
Nodes (7): Code graph, Database, Folder structure, Requirements knowledge base, Setup, Shopify Theme Auditor, Stack

## Knowledge Gaps
- **152 isolated node(s):** `RuleContext`, `ExecutedFinding`, `RunRulesSummary`, `missingSectionRule`, `missingSnippetRule` (+147 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `parseJsonFile()` connect `parseJsonFile.ts` to `theme-parser/index.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `dependencies`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `RuleContext`, `ExecutedFinding`, `RunRulesSummary` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `connectToDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.05827505827505827 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._