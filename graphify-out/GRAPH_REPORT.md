# Graph Report - Shopify Theme Auditor  (2026-11-23)

## Corpus Check
- 871 files · ~522,178 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5084 nodes · 12910 edges · 199 communities (190 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `323f413d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- diffFindings.ts
- devDependencies
- dependencies
- compilerOptions
- types.ts
- analytics/constants.ts
- runSync.integration.test.ts
- session.ts
- period.ts
- settings.ts
- findings.tsx
- add-theme.ts
- pageSpeed.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- parseJsonFile.ts
- persist.ts
- api/manual-hours.ts
- Phase 4 — Advanced Static Analysis & Audit Quality
- accessibility/index.ts
- googleChat.ts
- cross-file/index.ts
- analytics/compute.ts
- BreakdownTable.tsx
- Shopify Theme Auditor
- compare-sheet-with-reports.ts
- autoAudit.ts
- googleConnections.ts
- SalesContent.tsx
- computeScoreboard.ts
- installEvents.ts
- Phase 5 — Audit Results, Reporting & Export
- metrics.ts
- projects/constants.ts
- crawlCatalog.ts
- Phase 7 — Submission Readiness, Rule Coverage & Maintenance
- oauth.ts
- ended-posts.ts
- scripts
- Ga4ThemesSection.tsx
- projects/[id]/page.tsx
- importReports.ts
- detectionJob.ts
- analytics.ts
- teams-tab.tsx
- parseSalesFile.ts
- app/team/page.tsx
- useApi
- runSync.ts
- getPageLabel
- mutate
- resolve.ts
- ProjectDetail.tsx
- Phase 2 — Shopify Theme Parser
- service-project.ts
- insights/page.tsx
- publicUrl.ts
- [id]/export/google-sheet/route.ts
- runCheck.ts
- api/reports.ts
- categories.ts
- deadlines/page.tsx
- extractReadmeVersion.ts
- demo-store/page.tsx
- OverviewPanel.tsx
- interaction.ts
- RevenueView.tsx
- days-worked/route.ts
- themes.ts
- GA4 Analytics — Architecture
- oauthState.ts
- crawlPartners.ts
- connectToDatabase
- ShopifyAppStoreTab.tsx
- Phase 8 — Testing, Security, Performance & Deployment
- audit-run.ts
- googleOAuth.ts
- current-work/page.tsx
- category/route.ts
- Phase 1 — Shopify Requirements & Standards Knowledge Base
- timer-message.ts
- Phase 0 — Foundation & MongoDB Scaffolding
- Security
- ThemeDetailTabs.tsx
- Phase 6 — Re-Audit, Diff & Finding Lifecycle
- buildTestTheme.ts
- themes/page.tsx
- fmtMinutes
- diff.tsx
- hours.ts
- import-sales.ts
- editors.tsx
- googleAds.ts
- recordServiceAudit
- record.ts
- phase-3-static-rules-updated.md
- syncSpace.ts
- extractLiquidStructure.ts
- report.ts
- fetchPublic.ts
- executeAuditRun.ts
- theme-parser/index.ts
- activity-rules.ts
- recheck-report-hours.ts
- AttendanceView.tsx
- storefrontPassword.ts
- 29. Final product acceptance test
- service/analytics/page.tsx
- 23. Comparison tests
- headingChecks.ts
- service/layout.tsx
- Themes section: automation scope
- 15. False-positive prevention
- 5. Accessibility Rules
- requirement.ts
- Phase 3 — Shopify Theme Store Compliance & Static Rules Engine
- 7. Diff states
- 13. Error handling
- 13. Severity model
- 16. Rule testing
- AGENTS.md
- service/page.tsx
- fetchPageFacts.ts
- crawlApps.ts
- 6. Technical SEO Rules
- 7. Technical AEO / Structured Data Rules
- enhancementSheetFormatting.ts
- import-revenue-sheet.ts
- parseDirectory.ts
- google.ts
- [slug]/page.tsx
- Decisions
- rules.ts
- parseApps.ts
- demoContent.ts
- shopify/index.ts
- runLiveChecks.ts
- ThemeCostSection.tsx
- seed-rules.ts
- themeStoreFeatures.ts
- [id]/export/route.ts
- Trends.tsx
- costs/route.ts
- instrumentation.ts
- sheetRows.ts
- internal/index.ts
- categoryDashboard.tsx
- versionTime.ts
- 17. Diff UI
- aggregate-release-notes.mjs
- readiness/route.ts
- aggregate.ts
- shopifyApps/scheduler.ts
- demoPasswords.ts
- harvest-release-notes.mjs
- enhancementReport.tsx
- 6. Matching algorithm
- 22. Exporting diffs
- 2. Test levels
- syncReviewStatuses.ts
- 3. Shopify Section & Schema Rules
- 20. Deployment architecture
- .prettierrc.json
- performance/layout.tsx
- loadDeadlines.ts
- gitSource.ts
- package.json
- runRules.ts
- summary.ts
- ServiceChatPanel.tsx
- bugs/index.ts
- enhancement-point.ts
- technical-aeo/index.ts
- accessibility/index.test.ts
- theme-store-theme.ts
- commit-list.mjs
- TeamHoursTable.tsx
- theme.ts
- format.tsx
- service-remove-new-project-duplicates.ts
- archive/README.md
- google-auth-library
- ruleCitations.ts
- @googleapis/analyticsadmin
- liquidJson.ts
- imageSizeFromBytes
- extractCssStructure.ts

## God Nodes (most connected - your core abstractions)
1. `connectToDatabase()` - 388 edges
2. `isValidObjectId()` - 98 edges
3. `recordServiceAudit()` - 93 edges
4. `invalidIdResponse()` - 91 edges
5. `handle()` - 75 edges
6. `Theme` - 59 edges
7. `readBody()` - 58 edges
8. `badRequest()` - 52 edges
9. `fmtMinutes()` - 42 edges
10. `useApi()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `ServiceProfilesPage()` --indirect_call--> `listProfiles()`  [INFERRED]
  app/service/review/profiles/page.tsx → lib/service/api/review.ts
- `ServiceClientsPage()` --indirect_call--> `listClients()`  [INFERRED]
  app/service/review/clients/page.tsx → lib/service/api/review.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/health/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/maintenance/route.ts → lib/db/connect.ts
- `GET()` --calls--> `connectToDatabase()`  [EXTRACTED]
  app/api/requirements/route.ts → lib/db/connect.ts

## Import Cycles
- None detected.

## Communities (199 total, 9 thin omitted)

### Community 0 - "diffFindings.ts"
Cohesion: 0.11
Nodes (25): GET(), toPlainRecord(), attributeNewFindings(), CategoryDiffSummary, computeFindingsDiff(), countNewOrEscalatedHighRiskFindings(), DiffFinding, DiffStatus (+17 more)

### Community 1 - "devDependencies"
Cohesion: 0.07
Nodes (29): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, pg, prettier, tailwindcss (+21 more)

### Community 2 - "dependencies"
Cohesion: 0.07
Nodes (29): exceljs, @googleapis/analyticsdata, @googleapis/oauth2, @googleapis/sheets, htmlparser2, lucide-react, mongodb, mongoose (+21 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "types.ts"
Cohesion: 0.13
Nodes (23): ARIA_REFERENCE_ATTRS, DEDICATED_INTERACTIVE_TAGS, HtmlStructure, StackFrame, TEXT_CAPTURE_TAGS, ParsedAriaReference, ParsedButton, ParsedElementId (+15 more)

### Community 5 - "analytics/constants.ts"
Cohesion: 0.10
Nodes (24): AGGREGATE_BREAKDOWNS, AggregateBreakdown, GA4_DATE_PATTERN, GA4_PROPERTY_ID_PATTERN, PRIMARY_EVENTS, TRACKED_EVENTS, EngineDeps, DAYS (+16 more)

### Community 6 - "runSync.integration.test.ts"
Cohesion: 0.11
Nodes (28): CHUNK_DAYS, countDueSyncs(), defaultSyncDeps, drainSyncQueue(), dueQueuedJobs(), datesBetween(), fakeAdmin, FakeGa4 (+20 more)

### Community 7 - "session.ts"
Cohesion: 0.06
Nodes (55): DELETE(), POST(), LegalPage(), AppShell(), isActive(), MobileNav(), FOOTER_ITEMS, NAV_ITEMS (+47 more)

### Community 9 - "period.ts"
Cohesion: 0.19
Nodes (19): dashHref(), PeriodBar(), periodHref(), pill(), TeamsTab(), dynamic, ServiceTeamPage(), GRANULARITIES (+11 more)

### Community 10 - "settings.ts"
Cohesion: 0.09
Nodes (17): articleFieldsRule, blogFieldsRule, collectionFieldsRule, colorSystemRule, contactPageRule, countColorSettings(), missingLabelRule, NON_LABELABLE_SETTING_TYPES (+9 more)

### Community 11 - "findings.tsx"
Cohesion: 0.07
Nodes (37): AuditDiagnostics, CATEGORIES, CoverageSummary, CoverageSummaryBar(), DiagnosticsNote(), EngineVersions, EngineVersionsNote(), FindingsTable() (+29 more)

### Community 12 - "add-theme.ts"
Cohesion: 0.15
Nodes (14): GET(), POST(), RankingCheckResult, fetchThemeStoreFeatureLabels(), ThemeRankHistory, ThemeRankHistoryDoc, themeRankHistorySchema, ThemeRankingCheckState (+6 more)

### Community 13 - "pageSpeed.ts"
Cohesion: 0.12
Nodes (29): cleanExplanation(), contrastFindingsFromPsi(), nodeOf(), touchTargetFindingsFromPsi(), averageDefined(), discoverPageUrls(), extractCoreMetrics(), extractOpportunityFindings() (+21 more)

### Community 17 - "parseJsonFile.ts"
Cohesion: 0.16
Nodes (18): findFocusableInsideAriaHidden(), DuplicateJsonKey, findDuplicateJsonKeys(), Frame, extractJsImports(), buildLineIndex(), extractSettingKeys(), extractTemplateSectionReferences() (+10 more)

### Community 18 - "persist.ts"
Cohesion: 0.03
Nodes (123): POST(), closeHeldFromEndedPosts(), CloseHeldResult, SINCE, listServiceMessages(), serviceChatSpace(), AcceptedPost, key() (+115 more)

### Community 19 - "api/manual-hours.ts"
Cohesion: 0.14
Nodes (24): Ctx, DELETE(), PATCH(), Ctx, GET(), POST(), addManualHours(), allocateManualHours() (+16 more)

### Community 20 - "Phase 4 — Advanced Static Analysis & Audit Quality"
Cohesion: 0.04
Nodes (44): 10. Duplicate and conflict detection, 11. Cross-file JavaScript analysis, 12. Accessibility cross-file analysis, 13. CSS accessibility analysis, 14. Performance structure analysis, 15. Rule confidence, 16. False-positive controls, 17. Audit diagnostics (+36 more)

### Community 21 - "accessibility/index.ts"
Cohesion: 0.09
Nodes (20): contrastRatio(), parseColorToRgb(), relativeLuminance(), srgbChannelToLinear(), ariaExpandedRule, ariaHiddenFocusableRule, BG_LIKE_PROPS, clickNoKeyboardRule (+12 more)

### Community 22 - "googleChat.ts"
Cohesion: 0.13
Nodes (21): GET(), GET(), GET(), buildChatAuthUrl(), CHAT_MEMBERSHIPS_SCOPE, CHAT_MESSAGES_SCOPE, CHAT_OAUTH_CALLBACK_PATH, CHAT_OAUTH_SCOPES (+13 more)

### Community 23 - "cross-file/index.ts"
Cohesion: 0.09
Nodes (24): collectRenderedSnippets(), ComposedTemplate, composeTemplate(), composeTemplateMainContent(), orderedSectionTypes(), resolveLayoutFile(), templateBaseName(), brokenAriaReferenceRule (+16 more)

### Community 24 - "analytics/compute.ts"
Cohesion: 0.09
Nodes (28): addDays(), Analytics, AnalyticsInput, AProject, ClientLine, computeAnalytics(), MonthLine, PersonWeek (+20 more)

### Community 25 - "BreakdownTable.tsx"
Cohesion: 0.07
Nodes (50): BreakdownTable(), Column, FilterAction(), PARAM_FOR_DIM, rowFilters(), rowLabel(), dimsOf(), FILTER_LABELS (+42 more)

### Community 26 - "Shopify Theme Auditor"
Cohesion: 0.14
Nodes (13): Code graph, Database, Folder structure, Future updates (enhancement points), Google Sheets export, Live checks against real demo stores, Native capabilities (no app required), Per-theme detection (+5 more)

### Community 28 - "compare-sheet-with-reports.ts"
Cohesion: 0.19
Nodes (12): CUTOFF, d1(), iso(), main(), norm(), SHEET, apply, file (+4 more)

### Community 29 - "autoAudit.ts"
Cohesion: 0.06
Nodes (61): parseDemoStorePresets(), POST(), GET(), POST(), GET(), POST(), GET(), GET() (+53 more)

### Community 30 - "googleConnections.ts"
Cohesion: 0.15
Nodes (19): decryptSecret(), encryptSecret(), getEncryptionKey(), key, ConnectionLike, disconnectConnection(), getAuthorizedClient(), iso() (+11 more)

### Community 31 - "SalesContent.tsx"
Cohesion: 0.11
Nodes (38): ResponsiveTable(), TableColumn, CategoriesTab(), CategoryRow, CrawlProgress, PresetCategory, CountriesTab(), countryName() (+30 more)

### Community 32 - "computeScoreboard.ts"
Cohesion: 0.08
Nodes (38): EnhancementDetection, FeatureMatrixRow, FeatureMatrixTable(), GROUP_TINTS, GROUPS, sourcesText(), yesNo(), FeatureSuggestions() (+30 more)

### Community 33 - "installEvents.ts"
Cohesion: 0.08
Nodes (39): DashboardControls(), ThemeOption, GET(), DATE_RANGE_LABELS, DATE_RANGE_PRESETS, DateRange, DateRangeError, DateRangePreset (+31 more)

### Community 34 - "Phase 5 — Audit Results, Reporting & Export"
Cohesion: 0.04
Nodes (44): 10. Category dashboards, 11. Audit diagnostics, 12. Search, 13. Export formats, 14. Optional Google Sheets integration, 15. Report generation model, 16. Report snapshots, 17. Rule/version information (+36 more)

### Community 35 - "metrics.ts"
Cohesion: 0.08
Nodes (50): GET(), GET(), GET(), GET(), datesInRange(), daysBetween(), rangeLength(), filterMatch() (+42 more)

### Community 36 - "projects/constants.ts"
Cohesion: 0.05
Nodes (79): GET(), PATCH(), GET(), POST(), GET(), POST(), ProjectStatusPill(), TONE (+71 more)

### Community 37 - "crawlCatalog.ts"
Cohesion: 0.14
Nodes (25): GET(), POST(), fetchPublicText(), sleep(), crawlCatalog(), crawlCategories(), crawlDetails(), crawlListing() (+17 more)

### Community 38 - "Phase 7 — Submission Readiness, Rule Coverage & Maintenance"
Cohesion: 0.05
Nodes (38): 10. Partial rules, 11. Rule inventory, 12. Rule versioning, 13. Requirement versioning, 14. Requirement review workflow, 15. Rule review metadata, 16. Rule test coverage, 17. Critical rule classification (+30 more)

### Community 39 - "oauth.ts"
Cohesion: 0.14
Nodes (19): GET(), KNOWN_GOOGLE_ERRORS, POST(), GET(), createOAuthClient(), disconnectGoogle(), exchangeCodeForTokens(), getGoogleConnectionStatus() (+11 more)

### Community 40 - "ended-posts.ts"
Cohesion: 0.26
Nodes (9): AcceptedPostLite, compatible(), day(), EndedPostLite, HeldProject, nameKey(), planClosures(), d() (+1 more)

### Community 41 - "scripts"
Cohesion: 0.09
Nodes (23): scripts, build, commits, db:backup, db:compact, dev, format, format:check (+15 more)

### Community 43 - "Ga4ThemesSection.tsx"
Cohesion: 0.14
Nodes (21): Banner, BANNER_CLASSES, bannerFromParams(), Connection, Ga4ConnectionsContent(), STATUS_PILLS, formatDateTime(), PillTone (+13 more)

### Community 44 - "projects/[id]/page.tsx"
Cohesion: 0.07
Nodes (46): InHouseEditor(), KeywordsEditor(), PeopleEditor(), ProfileEditor(), ReviewEditor(), split(), useSave(), Avatar() (+38 more)

### Community 45 - "importReports.ts"
Cohesion: 0.10
Nodes (26): GET(), POST(), POST(), addPostersToTeams(), buildReport(), Built, Candidate, Context (+18 more)

### Community 46 - "detectionJob.ts"
Cohesion: 0.14
Nodes (18): POST(), HttpStatusError, detectionProgress(), g, JobState, presetFromSheet(), runDetection(), startDetection() (+10 more)

### Community 47 - "analytics.ts"
Cohesion: 0.11
Nodes (30): build(), fingerprint(), GET(), Row, Analytics, AppRow, basics(), CategoryInsight (+22 more)

### Community 48 - "teams-tab.tsx"
Cohesion: 0.17
Nodes (18): BAD, Kpi(), LINK, Overview(), SECTION, TH, THEAD, WARN (+10 more)

### Community 49 - "parseSalesFile.ts"
Cohesion: 0.19
Nodes (17): cellText(), fixMojibake(), HEADER_ALIASES, isPresetValue(), looksLikeDomain(), norm(), normalizeChargeType(), normalizeDomain() (+9 more)

### Community 50 - "app/team/page.tsx"
Cohesion: 0.13
Nodes (13): Modal(), ChatStatus, ImportReportsModal(), RecheckResult, Summary, SyncResult, VerifyResult, Member (+5 more)

### Community 51 - "useApi"
Cohesion: 0.06
Nodes (40): ANALYTICS_SECTIONS, AnalyticsShell(), DataNotes(), DataWarnings(), OverviewContent(), ApiState, Result, useApi() (+32 more)

### Community 52 - "runSync.ts"
Cohesion: 0.06
Nodes (59): GET(), AggregateDimension, buildDimsKey(), attributeInstalls(), InstallAttribution, installRows(), installsByThemeRequest(), isUnset() (+51 more)

### Community 53 - "getPageLabel"
Cohesion: 0.11
Nodes (17): BASE_TEMPLATE_LABELS, EXACT_TEMPLATE_LABELS, getPageLabel(), buildFindingsCsv(), COLUMNS, CsvFindingRow, escapeCsvField(), buildReportHtml() (+9 more)

### Community 54 - "mutate"
Cohesion: 0.09
Nodes (26): CloseFromPosts(), Plan, AssignmentsEditor(), Person, Role, NewProjectForm(), AssignRow(), ClientOption (+18 more)

### Community 55 - "resolve.ts"
Cohesion: 0.17
Nodes (22): themes, applyMainThemePreset(), applyThemeMerge(), escapeRegExp(), findTheme(), fold(), FoundTheme, hasWord() (+14 more)

### Community 56 - "ProjectDetail.tsx"
Cohesion: 0.07
Nodes (29): BreakdownSection(), GroupTable(), InstallsSection(), isUrl(), Button, ButtonSize, ButtonVariant, SIZE_CLASSES (+21 more)

### Community 57 - "Phase 2 — Shopify Theme Parser"
Cohesion: 0.05
Nodes (37): 10. Translation and localization extraction, 11. Scripts and performance-related structures, 12. Stylesheets and CSS, 13. Liquid references, 14. Deprecated Shopify references, 15. Asset and file references, 16. JSON templates and configuration, 17. Locale files (+29 more)

### Community 58 - "service-project.ts"
Cohesion: 0.04
Nodes (67): POST(), disconnectChat(), ServiceChatStatus, DM_MEMBERS, DepartmentRow, loadProjectDepartments(), ServiceAuditLog, ServiceAuditLogDoc (+59 more)

### Community 59 - "insights/page.tsx"
Cohesion: 0.07
Nodes (23): Tab, TabbedPageClient(), CodeReviewContent(), ImplementationType, Requirement, RequirementsReview(), RULE_STATUS_LABELS, RULE_STATUS_STYLES (+15 more)

### Community 60 - "publicUrl.ts"
Cohesion: 0.18
Nodes (12): assertPublicUrl(), blocked, BlockedUrlError, fetchPublicBytes(), fetchPublicPage(), isBlockedAddress(), Lookup, PublicFetchOptions (+4 more)

### Community 61 - "[id]/export/google-sheet/route.ts"
Cohesion: 0.12
Nodes (34): POST(), sheetsErrorMessage(), POST(), sheetsErrorMessage(), buildEnhancementReportForRun(), EnhancementDetectionRecord, EnhancementReportPoint, buildEnhancementSheetTabs() (+26 more)

### Community 62 - "runCheck.ts"
Cohesion: 0.11
Nodes (29): POST(), GET(), checkPendingThemeStoreListings(), LISTING_RECHECK_MS, fetchLiveDemoStoreTheme(), LiveThemeResult, backfillDemoStoreField(), checkStore() (+21 more)

### Community 63 - "api/reports.ts"
Cohesion: 0.15
Nodes (30): ATTENTION, buildPeople(), CLOSED, Context, DAY_MS, dayOf(), daysBetween(), DepartmentsReport (+22 more)

### Community 64 - "categories.ts"
Cohesion: 0.07
Nodes (42): POST(), GET(), POST(), currentRows(), GET(), parseQuery(), POST(), buildListingUrl() (+34 more)

### Community 65 - "deadlines/page.tsx"
Cohesion: 0.18
Nodes (13): Benchmark, Data, DeadlinesPage(), Filter, Row, day(), plural(), Timing (+5 more)

### Community 66 - "extractReadmeVersion.ts"
Cohesion: 0.13
Nodes (19): ExtractedTheme, extractEntries(), extractThemeZip(), MAX_FILE_COUNT, MAX_SINGLE_FILE_BYTES, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_BYTES, safeEntryPath() (+11 more)

### Community 68 - "demo-store/page.tsx"
Cohesion: 0.11
Nodes (22): Account, AdsData, formatId(), GoogleAdsTab(), DemoStoreData, DemoStoreRecord, DemoStoreView(), FilteredRankingData (+14 more)

### Community 69 - "OverviewPanel.tsx"
Cohesion: 0.07
Nodes (31): DemoStorePasswords(), hostOf(), DemoStorePreset, PresetLinksEditor(), AddThemeModal(), CheckTotals, DevThemeCard(), DevThemeRow (+23 more)

### Community 71 - "interaction.ts"
Cohesion: 0.13
Nodes (18): collectCssRules(), CssRuleSource, lineOf(), neutralizeLiquid(), parseInto(), resolveNestedSelector(), splitSelectorList(), ACCESSIBILITY_INTERACTION_RULES (+10 more)

### Community 72 - "RevenueView.tsx"
Cohesion: 0.13
Nodes (21): Diff(), GroupId, GROUPS, link(), monthLabel(), ProjectTable(), RANGES, RevenueView() (+13 more)

### Community 73 - "days-worked/route.ts"
Cohesion: 0.13
Nodes (19): GET(), GET(), DaysReport, DaysRow, isManager(), summarizeDays(), toDays(), toHours() (+11 more)

### Community 74 - "themes.ts"
Cohesion: 0.06
Nodes (51): GET(), POST(), AdminApi, createAdminApi(), Ga4PropertyDetails, Ga4PropertyError, Ga4PropertySummary, getPropertyDetails() (+43 more)

### Community 75 - "GA4 Analytics — Architecture"
Cohesion: 0.06
Nodes (34): 1. The existing application (audit findings), 2. GA4 architecture, 3.1 `AnalyticsTheme` (`models/analytics-theme.ts`), 3.2 `GoogleConnection` (`models/google-connection.ts`), 3.3 `AnalyticsSync` (`models/analytics-sync.ts`), 3.4 `AnalyticsAggregate` (`models/analytics-aggregate.ts`), 3. Database design, 4. Analytics correctness constraints (binding on Phases 4–7) (+26 more)

### Community 77 - "oauthState.ts"
Cohesion: 0.27
Nodes (11): GET(), OAUTH_ERROR_MESSAGES, GET(), GET(), buildGa4AuthUrl(), exchangeGa4Code(), createOAuthState(), ga4SettingsUrl() (+3 more)

### Community 78 - "crawlPartners.ts"
Cohesion: 0.13
Nodes (26): GET(), POST(), GET(), POST(), CrawlState, DetailState, fetchPage(), g (+18 more)

### Community 79 - "connectToDatabase"
Cohesion: 0.07
Nodes (59): DELETE(), POST(), GET(), POST(), POST(), PATCH(), POST(), GET() (+51 more)

### Community 81 - "ShopifyAppStoreTab.tsx"
Cohesion: 0.09
Nodes (24): formatDateTime(), CategoryApp, CategoryData, CategoryFeature, CategoryWorkspace(), num(), pctText(), PHASE_LABEL (+16 more)

### Community 82 - "Phase 8 — Testing, Security, Performance & Deployment"
Cohesion: 0.07
Nodes (28): 10. API authorization boundary, 11. File privacy, 12. Audit data retention, 14. Audit observability, 15. Performance optimization, 16. Audit execution strategy, 17. MongoDB indexes and query performance, 18. Frontend performance (+20 more)

### Community 83 - "audit-run.ts"
Cohesion: 0.07
Nodes (40): GET(), GET(), failInterruptedAudits(), globalForRecovery, NOW, INTERRUPTED_AUDIT_ERROR, STALE_AUDIT_MS, startAuditRecovery() (+32 more)

### Community 84 - "googleOAuth.ts"
Cohesion: 0.17
Nodes (12): GET(), listConnections(), ANALYTICS_READONLY_SCOPE, createGa4OAuthClient(), Env, GA4_OAUTH_CALLBACK_PATH, GA4_OAUTH_SCOPES, Ga4OAuthError (+4 more)

### Community 85 - "current-work/page.tsx"
Cohesion: 0.17
Nodes (14): Cell, Data, dayLabel(), hours(), MissedReports(), monthLabel(), CurrentWorkPage(), Data (+6 more)

### Community 86 - "category/route.ts"
Cohesion: 0.17
Nodes (14): AppDoc, CategoryRow, GET(), PATCH(), DETAIL_VERSION, featureBelongsTo(), pricingModel, ShopifyApp (+6 more)

### Community 87 - "Phase 1 — Shopify Requirements & Standards Knowledge Base"
Cohesion: 0.08
Nodes (25): 1. Primary source: Shopify Theme Store requirements, 2. Internal theme standards, 3. Technical best practices, Acceptance criteria, Accessibility, Audit scope definitions, Bugs, Explicitly out of scope (+17 more)

### Community 88 - "timer-message.ts"
Cohesion: 0.12
Nodes (28): findDuplicateLines(), Classified, classifyMessage(), MessageKind, ev(), ist(), msg(), one() (+20 more)

### Community 89 - "Phase 0 — Foundation & MongoDB Scaffolding"
Cohesion: 0.09
Nodes (22): Acceptance criteria, Application stack, Audit lifecycle, `audit_runs`, `audit_settings`, Database model, Explicitly out of scope, `findings` (+14 more)

### Community 90 - "Security"
Cohesion: 0.40
Nodes (4): Fixed in the 2026-09-29 review, How access works, Security, Still to do (in priority order)

### Community 91 - "ThemeDetailTabs.tsx"
Cohesion: 0.06
Nodes (30): FeatureRow, STATUS_CLASS, STATUS_LABEL, ThemeFeatures, formatDateOnly(), BreadcrumbItem, Breadcrumbs(), PageContainer() (+22 more)

### Community 92 - "Phase 6 — Re-Audit, Diff & Finding Lifecycle"
Cohesion: 0.09
Nodes (22): 10. Finding lifecycle, 11. Manual finding status, 12. Ignored findings, 13. Reintroduced findings, 14. Rule changes between audits, 15. Requirement changes, 16. Diff API, 18. Before/after source comparison (+14 more)

### Community 93 - "buildTestTheme.ts"
Cohesion: 0.23
Nodes (11): basenameNoExt(), buildThemeIndex(), getPath(), isExternalReference(), localeKeyExists(), resolveSchemaString(), ThemeIndex, findingsFor() (+3 more)

### Community 94 - "themes/page.tsx"
Cohesion: 0.17
Nodes (18): CheckTotals, healthPercent(), healthTone(), isStale(), isVersionMismatch(), PrioritizedThemeRow, ROW_TONE_CLASS, rowTone() (+10 more)

### Community 95 - "fmtMinutes"
Cohesion: 0.13
Nodes (26): DeadlineCard(), BulkCreate(), Client, ClientRow(), UnmatchedList(), UnmatchedRow(), dynamic, ServiceClientsPage() (+18 more)

### Community 96 - "diff.tsx"
Cohesion: 0.12
Nodes (16): ATTRIBUTION_LABEL, CategoryDiffSummary, CategoryDiffTable(), DiffFindingDetail, DiffFindingRow, DiffFindingsView(), DiffSummaryBar(), FindingsDiffResult (+8 more)

### Community 97 - "hours.ts"
Cohesion: 0.07
Nodes (52): Ctx, GET(), PUT(), loadAnalytics(), RangeId, DashboardRow, EntryLite, getContract() (+44 more)

### Community 98 - "import-sales.ts"
Cohesion: 0.23
Nodes (20): POST(), POST(), TabResult, ImportResult, importSales(), saleDedupeKey(), isXlsx(), matchThemeForTab() (+12 more)

### Community 99 - "editors.tsx"
Cohesion: 0.28
Nodes (11): DepartmentRow(), NewDepartment(), PeopleDirectory(), PersonRow(), ProjectManagers(), Users, useSave(), dynamic (+3 more)

### Community 100 - "googleAds.ts"
Cohesion: 0.11
Nodes (29): GET(), GET(), GET(), ADS_OAUTH_CALLBACK_PATH, ADS_OAUTH_SCOPES, ADS_SCOPE, ADS_STATE_COOKIE, adsAccessToken() (+21 more)

### Community 102 - "recordServiceAudit"
Cohesion: 0.04
Nodes (124): maxDuration, POST(), PUT(), DELETE(), PUT(), POST(), GET(), POST() (+116 more)

### Community 103 - "record.ts"
Cohesion: 0.04
Nodes (48): Entry, forgetMemo(), g, AuditEntry, canonical(), computeHash(), GENESIS_HASH, verifyChain() (+40 more)

### Community 104 - "phase-3-static-rules-updated.md"
Cohesion: 0.12
Nodes (15): 10. Theme Configuration Rules, 11. JavaScript / Code Integrity Rules, 12. Internal Standards Rules, 14. Source traceability, 17. Real-theme validation, 18. Rule coverage, 19. Rule performance, 1. Shopify Theme Structure & Package Rules (+7 more)

### Community 105 - "syncSpace.ts"
Cohesion: 0.16
Nodes (20): POST(), POST(), getChatSpace(), getJson(), listMemberNames(), listSpaceMessages(), startChatSyncScheduler, chatAccessToken() (+12 more)

### Community 106 - "extractLiquidStructure.ts"
Cohesion: 0.12
Nodes (22): DEPRECATED_FILTER_NAMES, DEPRECATED_LIQUID_REFERENCES, DEPRECATED_OBJECT_NAMES, DEPRECATED_TAG_NAMES, DeprecatedEntry, blank(), classifyStringConfidence(), extractLiquidStructure() (+14 more)

### Community 107 - "report.ts"
Cohesion: 0.08
Nodes (39): cardText(), ChatMessage, DEFAULT_ATTENDANCE_SPACE, listAttendanceMessages(), RawAttendanceMessage, addDays(), buildGrid(), Cell (+31 more)

### Community 108 - "fetchPublic.ts"
Cohesion: 0.17
Nodes (8): BROWSER_UA, FetchPublicOptions, Nullable, fetchStoreVersionHistory(), MONTHS, parseReleaseDate(), parseVersionHistory(), StoreVersion

### Community 109 - "executeAuditRun.ts"
Cohesion: 0.08
Nodes (29): g, withAuditSlot(), detectEnhancementPoints(), EnhancementDetectionResult, EnhancementMatch, firstMatchLine(), AuditDiagnostics, computeAuditDiagnostics() (+21 more)

### Community 110 - "theme-parser/index.ts"
Cohesion: 0.16
Nodes (18): extractCssStructure(), extractHtmlStructure(), isLiquidExpression(), parseOneFile(), parseThemeDirectory(), parseThemeZip(), ThemeParseResult, ThemeParseTiming (+10 more)

### Community 111 - "activity-rules.ts"
Cohesion: 0.08
Nodes (29): attendanceSpace(), DEFAULT_SYNC_MONTHS, readAttendance(), syncAttendance(), withLease(), noteIfGoogleAccessLost(), ActivityResult, AUTO_HOLD_DM_REASON (+21 more)

### Community 112 - "recheck-report-hours.ts"
Cohesion: 0.26
Nodes (11): MONTHS, ParsedReport, parseReport(), Result, splitReports(), splitThemes(), apply, day() (+3 more)

### Community 114 - "AttendanceView.tsx"
Cohesion: 0.16
Nodes (12): AttendanceView(), Cell, dayLabel(), Flag, Leave, problem(), Report, Row (+4 more)

### Community 115 - "storefrontPassword.ts"
Cohesion: 0.22
Nodes (8): cookiePairs(), isPasswordPage(), LoginResult, loginToStorefront(), Lookup, parseHiddenInputs(), PasswordProtectedError, send()

### Community 116 - "29. Final product acceptance test"
Cohesion: 0.17
Nodes (12): 29. Final product acceptance test, Step 1, Step 10, Step 11, Step 2, Step 3, Step 4, Step 5 (+4 more)

### Community 117 - "service/analytics/page.tsx"
Cohesion: 0.17
Nodes (18): BarChart(), BarItem, HBars(), HRow, Kpi(), Panel(), RankTable(), AnalyticsPage() (+10 more)

### Community 118 - "23. Comparison tests"
Cohesion: 0.22
Nodes (9): 23. Comparison tests, Changed finding, File rename, Moved line, New finding, Persistent finding, Reintroduced finding, Resolved finding (+1 more)

### Community 119 - "headingChecks.ts"
Cohesion: 0.15
Nodes (12): ComposedHeading, ComposedHeadingIssue, findMultipleH1(), findMultipleH1Across(), findSkippedHeadingLevels(), findSkippedHeadingLevelsAcross(), HeadingIssue, imageDimensionsRule (+4 more)

### Community 120 - "service/layout.tsx"
Cohesion: 0.25
Nodes (9): ALL_TABS, ServiceNav(), TABS, VISIBLE, ago(), dynamic, lastSync(), ServiceLayout() (+1 more)

### Community 121 - "Themes section: automation scope"
Cohesion: 0.17
Nodes (11): 1. Why the page is little used, 2. Every process today, 3. Proposed automation, in build order, 4. Decisions needed from the owner, 5. Suggested order and size, 6. Constraints to keep, Phase 1: make the page fill itself with no human input (small, no new inputs needed), Phase 2: audits without a ZIP, and scheduled audits (+3 more)

### Community 122 - "15. False-positive prevention"
Cohesion: 0.29
Nodes (7): 15. False-positive prevention, Conditional markup, Decorative images, Dynamic content, Optional Shopify structures, Reusable sections, Translation strings

### Community 123 - "5. Accessibility Rules"
Cohesion: 0.29
Nodes (7): 5. Accessibility Rules, Contrast, Forms, HTML language, Images, Interactive elements, SVG and icons

### Community 124 - "requirement.ts"
Cohesion: 0.11
Nodes (22): CheckStatus, GET(), GET(), GET(), RequirementImplementationType, FINDING_CATEGORIES, Requirement, REQUIREMENT_SOURCE_TYPES (+14 more)

### Community 125 - "Phase 3 — Shopify Theme Store Compliance & Static Rules Engine"
Cohesion: 0.33
Nodes (6): Core principle, Phase 3 — Shopify Theme Store Compliance & Static Rules Engine, Rule classification, Rule execution, Rule priority, Rule shape

### Community 126 - "7. Diff states"
Cohesion: 0.33
Nodes (6): 7. Diff states, Changed, New, Resolved, Still present, Unchanged

### Community 127 - "13. Error handling"
Cohesion: 0.33
Nodes (6): 13. Error handling, Database error, Diff error, Export error, Parser error, Rule error

### Community 128 - "13. Severity model"
Cohesion: 0.40
Nodes (5): 13. Severity model, Blocker, High, Low, Medium

### Community 129 - "16. Rule testing"
Cohesion: 0.40
Nodes (5): 16. Rule testing, Dynamic case, Edge case, Positive failure case, Positive pass case

### Community 132 - "service/page.tsx"
Cohesion: 0.05
Nodes (75): ACCENT, DOT, dynamic, h1(), href(), isoDay(), Kind, kindOf() (+67 more)

### Community 133 - "fetchPageFacts.ts"
Cohesion: 0.17
Nodes (13): extractPageFactsFromHtml(), fetchHtml(), fetchOnce(), fetchPageFacts(), isAbortError(), PageFacts, comparePresets(), PresetFacts (+5 more)

### Community 134 - "crawlApps.ts"
Cohesion: 0.16
Nodes (23): GET(), POST(), crawlListings(), CrawlState, crawlTree(), DETAIL_SCAN_BATCH, fetchPage(), g (+15 more)

### Community 135 - "6. Technical SEO Rules"
Cohesion: 0.40
Nodes (5): 6. Technical SEO Rules, Explicitly excluded SEO checks, Heading rules, Images, Metadata rules

### Community 136 - "7. Technical AEO / Structured Data Rules"
Cohesion: 0.40
Nodes (5): 7. Technical AEO / Structured Data Rules, Article schema, JSON-LD validity, Organization schema, Product schema

### Community 137 - "enhancementSheetFormatting.ts"
Cohesion: 0.07
Nodes (33): ENHANCEMENT_TAB_COLUMNS, FUTURE_UPDATES_TAB_COLUMNS, SheetFormattingRequest, buildEnhancementSheetFormattingRequests(), buildFormattingForColumns(), buildFutureUpdatesFormattingRequests(), COLUMN_WIDTHS, DETECTED_COLORS (+25 more)

### Community 138 - "import-revenue-sheet.ts"
Cohesion: 0.21
Nodes (11): ServiceRevenueTaken, ServiceRevenueTakenDoc, serviceRevenueTakenSchema, apply, file, main(), MON, plain() (+3 more)

### Community 140 - "parseDirectory.ts"
Cohesion: 0.24
Nodes (13): GET(), PartnerRow, crawlListing(), cleanUrl(), countryLabel(), decode(), parseCards(), parseCountrySlugs() (+5 more)

### Community 141 - "google.ts"
Cohesion: 0.14
Nodes (20): GET(), googleTokenError(), GET(), isValidOAuthState(), SERVICE_CHAT_STATE_COOKIE, serviceChatReturnUrl(), serviceChatStateCookieOptions, accessToken() (+12 more)

### Community 142 - "[slug]/page.tsx"
Cohesion: 0.19
Nodes (18): MoneyCell(), Meter(), occupancyState(), stars(), Stat(), dynamic, MembersPage(), dynamic (+10 more)

### Community 143 - "Decisions"
Cohesion: 0.11
Nodes (18): 0. Restart here (where we stopped, Tue 2026-11-17), 1. Environments and deployment, 2. Service Team section (`/service`), 3. Shopify App Store (Demo Store > Shopify App Store), 4. Attendance (`/attendance`), 5. Adding a theme, and install-event details (Analytics), 5b. Speed pass 2026-11-17 (owner: "the app is very slow, optimise it in the current environment, no upgrade"), 6. Code audit 2026-11-11: fixes made and what remains (+10 more)

### Community 144 - "rules.ts"
Cohesion: 0.11
Nodes (14): FindingCategory, Rule, RuleContext, RuleFinding, Severity, CROSS_FILE_RULES, BASE_LAYOUT, imageDimensionsRule (+6 more)

### Community 145 - "parseApps.ts"
Cohesion: 0.21
Nodes (14): crawlDetails(), AppCard, AppDeepDetail, AppDetail, AppFeature, AppPlan, decode(), listItems() (+6 more)

### Community 146 - "demoContent.ts"
Cohesion: 0.20
Nodes (9): DemoContent, DemoImage, describeSlot(), findProduct(), HIDDEN_CLASS_TOKENS, ProductData, productFromJsonLd(), resolveUrl() (+1 more)

### Community 147 - "shopify/index.ts"
Cohesion: 0.10
Nodes (17): contentForHeaderRule, hardcodedStorefrontTextRule, hardcodedTextConfidence(), isLiquidOutput(), KNOWN_TRANSLATABLE_PHRASES, normalizeCandidateText(), noRobotsTemplateRule, noSassRule (+9 more)

### Community 148 - "runLiveChecks.ts"
Cohesion: 0.13
Nodes (27): extractDemoContent(), CATEGORY, contentImagesOf(), DemoPageType, demoRealismFindings(), fileName(), imageKey(), imageProbeFindings() (+19 more)

### Community 149 - "ThemeCostSection.tsx"
Cohesion: 0.23
Nodes (13): amount(), Data, download(), exportPeople(), exportThemes(), inr, Lines, money() (+5 more)

### Community 150 - "seed-rules.ts"
Cohesion: 0.29
Nodes (7): computeRuleCriticality(), RuleCriticality, ruleHasTestCoverage(), collectTestFileContents(), extractLiveCheckRequirementIds(), LIVE_CHECK_FILES, main()

### Community 151 - "themeStoreFeatures.ts"
Cohesion: 0.23
Nodes (11): extractDemoStoreIframeUrl(), extractFeatureLabels(), extractLatestRelease(), extractPresets(), extractReviewSummary(), fetchThemeStoreListingBySlug(), LatestRelease, PresetDemoUrlResult (+3 more)

### Community 152 - "[id]/export/route.ts"
Cohesion: 0.16
Nodes (18): CONTENT_TYPES, Format, FORMATS, GET(), GET(), computeCoverage(), computeCoverageByCategory(), CoverageResult (+10 more)

### Community 153 - "Trends.tsx"
Cohesion: 0.25
Nodes (9): dateToMs(), METRICS, Trends(), ChartSeries, LineChart(), nearestIndex(), PAD, SERIES_VARS (+1 more)

### Community 154 - "costs/route.ts"
Cohesion: 0.10
Nodes (34): GET(), computeThemeCosts(), COST_LINES, CostLine, FixedPayment, hourlyCost(), HOURS_PER_MONTH, HoursInput (+26 more)

### Community 155 - "instrumentation.ts"
Cohesion: 0.21
Nodes (9): register(), INTERVAL_MS, startAttendanceScheduler, intervalMs(), createRepeatingJob(), g, LoopState, CHECK_MS (+1 more)

### Community 156 - "sheetRows.ts"
Cohesion: 0.13
Nodes (19): mergeChecklistRows(), findingA, findingB, rowsFor(), buildChecklistRow(), buildChecklistSheetTabs(), FILE_COLUMN_INDEX, FINDING_COLUMN_INDEX (+11 more)

### Community 157 - "internal/index.ts"
Cohesion: 0.16
Nodes (9): headingMatchesSectionNameRule, INTERNAL_RULES, MERCHANDISING_AXES, repetitiveSectionAxisRule, sectionTopicText(), settingTextValues(), TemplateJson, TemplateSection (+1 more)

### Community 158 - "categoryDashboard.tsx"
Cohesion: 0.43
Nodes (6): CATEGORY_ORDER, CategoryDashboard(), categoryFindings(), countBySeverity(), countByStatus(), FindingRow

### Community 159 - "versionTime.ts"
Cohesion: 0.22
Nodes (10): dayNumber(), daysBetween(), round2(), versions, TimeEntryDay, VersionReport, VersionTimeResult, VersionTimeRow (+2 more)

### Community 160 - "17. Diff UI"
Cohesion: 0.40
Nodes (5): 17. Diff UI, New finding, Resolved finding, Still present, Tabs

### Community 161 - "aggregate-release-notes.mjs"
Cohesion: 0.20
Nodes (8): crawlCountry(), byTier, payload, points, themes, tier(), ENHANCEMENT_CATEGORIES, TOPICS

### Community 162 - "readiness/route.ts"
Cohesion: 0.36
Nodes (7): GET(), PATCH(), loadReadinessConfig(), FINDING_SEVERITIES, ReadinessConfigDoc, ReadinessConfigModel, readinessConfigSchema

### Community 163 - "aggregate.ts"
Cohesion: 0.19
Nodes (14): add(), buildSummary(), emptyMetrics(), GaMonth, groupBy(), installRate(), matrix(), Metrics (+6 more)

### Community 164 - "shopifyApps/scheduler.ts"
Cohesion: 0.33
Nodes (8): detailBacklog(), detailQueue(), needsDetail(), startDetailScan(), g, scheduleTick(), startShopifyAppsScheduler(), tick()

### Community 165 - "demoPasswords.ts"
Cohesion: 0.39
Nodes (10): DELETE(), GET(), PUT(), theme(), attachStorefrontSessions(), hostOf(), removePassword(), savedPasswordHosts() (+2 more)

### Community 166 - "harvest-release-notes.mjs"
Cohesion: 0.36
Nodes (8): collectSlugs(), decode(), get(), harvestTheme(), parseVersions(), queue, slugsOnly, worker()

### Community 167 - "enhancementReport.tsx"
Cohesion: 0.33
Nodes (5): EnhancementMatch, EnhancementReportPoint, EnhancementReportSection(), sortByAdoption(), TIER_STYLES

### Community 168 - "6. Matching algorithm"
Cohesion: 0.40
Nodes (5): 6. Matching algorithm, Stage 1 — Exact signature, Stage 2 — Stable rule/location match, Stage 3 — Source-context match, Stage 4 — Unmatched

### Community 169 - "22. Exporting diffs"
Cohesion: 0.50
Nodes (4): 22. Exporting diffs, CSV, JSON, XLSX

### Community 170 - "2. Test levels"
Cohesion: 0.50
Nodes (4): 2. Test levels, End-to-end tests, Integration tests, Unit tests

### Community 171 - "syncReviewStatuses.ts"
Cohesion: 0.14
Nodes (18): detectBuildStatus(), BEFORE_LIVE, BEFORE_REVIEW, detectReviewStatus(), key(), StoreFacts, storeNameMatchesTheme(), StatusChange (+10 more)

### Community 172 - "3. Shopify Section & Schema Rules"
Cohesion: 0.67
Nodes (3): 3. Shopify Section & Schema Rules, Schema validity, Section structure

### Community 173 - "20. Deployment architecture"
Cohesion: 0.67
Nodes (3): 20. Deployment architecture, Local development, Production

### Community 174 - ".prettierrc.json"
Cohesion: 0.25
Nodes (7): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma, useTabs

### Community 175 - "performance/layout.tsx"
Cohesion: 0.40
Nodes (3): PerfTabs(), TABS, dynamic

### Community 176 - "loadDeadlines.ts"
Cohesion: 0.15
Nodes (25): GET(), GET(), GET(), GET(), Report, workLabel(), DayCell, dayKey() (+17 more)

### Community 177 - "gitSource.ts"
Cohesion: 0.32
Nodes (9): POST(), fetchGitZip(), gitEnv(), gitFailureReason(), GitTestResult, GitZip, isValidGitUrl(), run (+1 more)

### Community 178 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 179 - "runRules.ts"
Cohesion: 0.22
Nodes (12): loadEnabledRules(), runAuditRules(), dedupeKey(), EMPTY_SUMMARY(), runRules(), RunRulesResult, RunRulesSummary, summarizeFindings() (+4 more)

### Community 180 - "summary.ts"
Cohesion: 0.16
Nodes (15): GET(), getSalesSummary(), loadGaMonths(), MANUAL_STATUS, noCategoryLabel(), STATUS_NOTE, SummaryQuery, SaleRecord (+7 more)

### Community 181 - "ServiceChatPanel.tsx"
Cohesion: 0.60
Nodes (4): ServiceChatPanel(), when(), SyncForm(), chatStatus()

### Community 182 - "bugs/index.ts"
Cohesion: 0.15
Nodes (7): BUG_RULES, duplicateAssetLoadingRule, duplicateSchemaIdRule, largeInlinePayloadRule, missingScopedSettingRule, validJsonLdRule, validSchemaBlockRule

### Community 183 - "enhancement-point.ts"
Cohesion: 0.07
Nodes (37): GET(), PATCH(), EnhancementPoint, Example, FutureUpdatesContent(), SOURCE_LABELS, STATUS_LABELS, STATUSES (+29 more)

### Community 184 - "technical-aeo/index.ts"
Cohesion: 0.17
Nodes (7): articleSchemaRule, breadcrumbSchemaRule, faqSchemaRule, organizationSchemaRule, productSchemaRule, TECHNICAL_AEO_RULES, websiteSchemaRule

### Community 186 - "theme-store-theme.ts"
Cohesion: 0.33
Nodes (5): GET(), Row, ThemeStoreTheme, ThemeStoreThemeDoc, themeStoreThemeSchema

### Community 187 - "commit-list.mjs"
Cohesion: 0.40
Nodes (4): args, lines, out, rows

### Community 188 - "TeamHoursTable.tsx"
Cohesion: 0.40
Nodes (4): Cell(), monthName(), TeamHoursTable(), TeamHoursRow

### Community 189 - "theme.ts"
Cohesion: 0.03
Nodes (92): AdminAudit, adminAuditSchema, CHAT_REPORT_STATUSES, ChatReport, ChatReportDoc, chatReportSchema, Project, ProjectDoc (+84 more)

### Community 190 - "format.tsx"
Cohesion: 0.14
Nodes (13): DayHours(), DayHoursDay, DayPerson, longDay(), Dept, StatusControl(), ALL_STATUSES, META (+5 more)

### Community 194 - "ruleCitations.ts"
Cohesion: 0.47
Nodes (4): Cited, RULE_CITATIONS, withoutRuleCitation(), ALL_RULES

### Community 196 - "liquidJson.ts"
Cohesion: 0.60
Nodes (4): extractLiteralJsonLdTypes(), neutralizeConditionals(), neutralizeOutputs(), tryParseLiquidJson()

### Community 197 - "imageSizeFromBytes"
Cohesion: 0.70
Nodes (3): imageSizeFromBytes(), jpegSize(), webpSize()

### Community 200 - "extractCssStructure.ts"
Cohesion: 0.33
Nodes (5): CSS_NAMED_COLORS, looksLikeColorValue(), ANIMATION_PROPERTIES, COLOR_PROPERTIES, ParsedCssInfo

## Knowledge Gaps
- **1684 isolated node(s):** `0. Restart here (where we stopped, Tue 2026-11-17)`, `1. Environments and deployment`, `Owner decisions`, `Where things are`, `Data model choices (differ from the old Postgres schema)` (+1679 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectToDatabase()` connect `connectToDatabase` to `diffFindings.ts`, `service/page.tsx`, `crawlApps.ts`, `runSync.integration.test.ts`, `import-revenue-sheet.ts`, `parseDirectory.ts`, `google.ts`, `add-theme.ts`, `[slug]/page.tsx`, `persist.ts`, `googleChat.ts`, `seed-rules.ts`, `[id]/export/route.ts`, `costs/route.ts`, `instrumentation.ts`, `compare-sheet-with-reports.ts`, `autoAudit.ts`, `installEvents.ts`, `readiness/route.ts`, `metrics.ts`, `projects/constants.ts`, `demoPasswords.ts`, `shopifyApps/scheduler.ts`, `oauth.ts`, `crawlCatalog.ts`, `syncReviewStatuses.ts`, `projects/[id]/page.tsx`, `importReports.ts`, `detectionJob.ts`, `analytics.ts`, `loadDeadlines.ts`, `runSync.ts`, `summary.ts`, `enhancement-point.ts`, `theme-store-theme.ts`, `service-project.ts`, `[id]/export/google-sheet/route.ts`, `runCheck.ts`, `theme.ts`, `categories.ts`, `days-worked/route.ts`, `themes.ts`, `oauthState.ts`, `crawlPartners.ts`, `audit-run.ts`, `googleOAuth.ts`, `category/route.ts`, `fmtMinutes`, `import-sales.ts`, `googleAds.ts`, `recordServiceAudit`, `record.ts`, `syncSpace.ts`, `report.ts`, `activity-rules.ts`, `recheck-report-hours.ts`, `service/analytics/page.tsx`, `service/layout.tsx`, `requirement.ts`?**
  _High betweenness centrality (0.280) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `google-auth-library`, `package.json`, `@googleapis/analyticsadmin`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `load()` connect `fmtMinutes` to `editors.tsx`, `recordServiceAudit`, `period.ts`, `projects/[id]/page.tsx`, `connectToDatabase`, `teams-tab.tsx`, `ServiceChatPanel.tsx`, `mutate`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `0. Restart here (where we stopped, Tue 2026-11-17)`, `1. Environments and deployment`, `Owner decisions` to the rest of the system?**
  _1684 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `diffFindings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10952380952380952 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._