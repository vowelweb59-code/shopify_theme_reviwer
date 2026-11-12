# Decisions

Read this first. It records **why the code is the way it is, where each part lives, and what is still open**, so the next
step can be decided without re-reading the project. Update it in the same change whenever a decision, a rule, a file
location or an open item changes.

## 1. Environments and deployment

| | Local | Live |
|---|---|---|
| URL | http://localhost:3000 (`npm run dev`, run from a normal terminal) | https://shopify-theme-reviwer.onrender.com |
| Database | Docker Mongo `shopify-theme-auditor-mongo` on 127.0.0.1:27017, db `shopify_theme_auditor` (`.env.local`) | Separate Atlas Mongo with real data (`.env.production.local`, Render's `MONGODB_URI`) |
| Build | Next.js 16 (Turbopack) | Render builds `Dockerfile` (standalone output) from GitHub `vowelweb59-code/shopify_theme_reviwer`, branch `master` |

- Env vars on the live site are set in the Render dashboard, not in the repo. `.env*` files are git-ignored.
- Render may not auto-deploy on push: after pushing `master`, check the Render dashboard's Deploys page.
- Login: one shared session (`BASIC_AUTH_USER/PASSWORD`, `lib/auth/session.ts`, `proxy.ts`). A production build refuses
  every page without them unless `BASIC_AUTH_DISABLED=1`.
- Dev-machine gotchas: a dev server started from Claude's shell crashes in the CSS step (Windows `0xc0000142`), so start
  it from your own terminal. Git Bash rewrites `/flags` into paths (use `//PID`) and `/service` URLs (use
  `MSYS_NO_PATHCONV=1`). A stopped dev server can leave `node.exe` holding port 3000 (`taskkill //PID <pid> //F`).
- Writes to the production database and Render dashboard changes are done by the owner, not by Claude.

## 2. Service Team section (`/service`)

The former **Upwork Project-Management** app (NestJS + Prisma/Postgres, folder `Desktop/Claude/Upwork Project-Management`)
ported into this app on 2026-11-09 so the owner can monitor the **service team** here. Hours come from the Google Chat
space **TIMER STATUS**; they are reported hours, not Upwork-verified billable hours.

### Owner decisions

| Decision | Consequence |
|---|---|
| Full port to MongoDB, not a proxy to the old API | One app, one database. The old app's Postgres is only the migration source. |
| **No overlap with the theme team** | Separate models, collections, folders, Chat connection, OAuth callback and scheduler. The theme team's `TeamMember`, `Project`, `TimeEntry`, `ChatConnection` and `lib/chat/*` are never used by the Service section, and the reverse holds too. |
| Shared login, everything visible | No roles, no per-project grants, no money or salary gating. Rates, fixed prices and salaries are shown and editable to anyone signed in. |
| Migrate the existing Postgres data | `scripts/migrate-upwork-postgres.ts` copies everything; ids are kept. |
| Own Google OAuth client allowed | `SERVICE_GOOGLE_CLIENT_ID/SECRET` (the **ops-web** client in Google Cloud project **Upwork-Ops-Platform**) override `GOOGLE_CLIENT_ID/SECRET` for the Service Chat connection only. |

### Where things are

| Area | Files |
|---|---|
| Models (collections `service_*`, `_id` = UUID string) | `models/service-shared.ts` (enums, `uuidId`), `service-user.ts` (managers directory, not logins), `service-client.ts`, `service-upwork.ts` (accounts, profiles, contract-list rows), `service-project.ts` (embeds `contract`, `people`, `assignments`, `history`), `service-department.ts`, `service-chat.ts` (spaces, senders incl. salary, messages, checkpoints, connection), `service-time-entry.ts`, `service-audit-log.ts` |
| Pure import rules (verbatim copies of the old app, with its tests) | `lib/service/import/*` (`plan.ts` is the planner; parsers; client/profile/sender matching; `week.ts`, `weekly-hours.ts`), `lib/service/projects/transitions.ts`, `sender-name.ts`, `lib/service/audit/hash-chain.ts` |
| Database-backed rules | `lib/service/import/persist.ts` (idempotent write + `runFollowUps`), `import/rematch.ts`, `hours/attribution.ts`, `hours/auto-assign.ts`, `projects/reporters.ts`, `projects/activity-rules.ts`, `reports/project-departments.ts`, `audit/record.ts` |
| Google Chat | `lib/service/chat/google.ts` (OAuth + reading), `sync.ts` (`syncServiceMonth`), `months.ts` (IST months), `scheduler.ts` (started in `instrumentation.ts`) |
| API logic (plain functions, used by pages and routes) | `lib/service/api/http.ts` (`handle`, `load`, `ServiceError`, input readers), `hours.ts`, `projects.ts`, `review.ts`, `reports.ts`, `team.ts`, `departments.ts`, `chat.ts` |
| Routes | `app/api/service/**` (thin wrappers around `lib/service/api/*`) |
| Pages | `app/service/layout.tsx` + `_components/ServiceNav.tsx`; `page.tsx` + `_dashboard/*` (dashboard), `projects/**`, `team/**`, `departments/**`, `review/**` (queue, clients, profiles, senders), `chat/**` |
| UI helpers | `lib/service/ui/format.tsx` (hours, money, status badges, legal next statuses), `client.ts` (`mutate()` to `/api/service/*`), `period.ts` |
| Scripts | `npm run service:migrate` (Postgres to Mongo; dry run unless `--apply`), `npm run service:reread` (re-plan stored messages; dry run unless `--apply`) |
| Tests | Pure rules: `lib/service/import/*.test.ts`, `lib/service/projects/*.test.ts`. Mongo integration: `lib/service/import/persist.integration.test.ts`, runs only with `SERVICE_TEST_MONGODB_URI` set (throwaway db). |

### Data model choices (differ from the old Postgres schema)

| Choice | Why |
|---|---|
| Contract embedded on `ServiceProject.contract` | Owner rule: one contract per project. |
| Time entries point at `projectId`; split entries have `allocations: [{projectId, minutes}]` and no `projectId` | Replaces `contractId` and the `entry_allocation` table. Every per-project total goes through `expandAllocations` + `projectOf` (`hours/attribution.ts`). |
| Entry carries `senderExternalId` | Per-person totals without joining messages. |
| `_id` = the Postgres UUID | Migrated references stay valid; new docs get `randomUUID()`. |
| Sessions, role grants, handovers, milestones, `financialAccess` not ported | Shared login; milestones and financials were empty placeholders. |
| Audit log keeps `actorId` | Old rows still verify against their hash chain; new rows have `actorId: null`. |

### Business rules (unchanged from the old app; full detail in its `DECISIONS.md`)

- Hours come only from TIMER STATUS (`spaces/AAAAZ1MQ5aQ`, override `SERVICE_CHAT_SPACE`). Import is per IST month,
  idempotent; an edited message replaces its own entries. Entries a person approved or rejected survive re-imports.
- Timer = OFF minus ON (same sender, client, profile); manual reports are real hours; with both on one day, the larger
  counts. Over 8h30 timer, stranded ON/OFF, zero-hour entries and OFF without ON are set aside (`AUTO_IGNORED`).
- Owner rule 29 Oct (`ON_TIMER_FROM_REPORT`): a report's ON-timer figure with no timer hours behind it counts. The old
  Postgres data predates it for older months, so re-reading adds about 270 h; that is intended.
- Week starts Monday; cutoff Monday 17:30 IST. Review never blocks counting.
- Placement for a client with several projects: first keyword written, then Upwork profile, then the only project
  listing the poster, then (if the client is set to split) equal shares over projects active in the last 14 days. A
  person's placement is never moved.
- Department follows the project manager; others go to the default department. 45 days without hours puts a project On
  hold; new hours lift only an automatic hold.
- Auto sync: this month every 15 minutes (`SERVICE_CHAT_SYNC_MINUTES`), last month once per IST day; skipped until
  Chat is connected.

### Status (2026-11-10)

Done: models, import pipeline, Chat connection and sync, all pages and routes, migration. Local database migrated
(44,651 entries, 1,728 projects, 1,631 clients). Typecheck, lint, 1013 tests and production build pass; every page
rendered with real data locally. `.env.local` has the ops-web client.

Open, in order:
1. Commit and push `master`; confirm Render deployed it.
2. Render dashboard: add `SERVICE_GOOGLE_CLIENT_ID` and `SERVICE_GOOGLE_CLIENT_SECRET` (ops-web), then redeploy.
   2026-11-10: live connect failed with `invalid_client` (Render log `[service-chat] OAuth callback failed`), so the
   secret on Render doesn't match the ID; re-paste both from `.env.local`. The callback now shows Google's reason on
   the page, and the credentials are trimmed.
3. Google Cloud, Upwork-Ops-Platform, client ops-web: authorized redirect URIs
   `http://localhost:3000/api/service/chat/google/callback` and
   `https://shopify-theme-reviwer.onrender.com/api/service/chat/google/callback`. The account that connects must be a
   member of TIMER STATUS (and a test user if the consent screen is in Testing).
4. Production data (owner runs it): `UPWORK_DATABASE_URL=<old app DATABASE_URL> npx tsx --env-file=.env.production.local scripts/migrate-upwork-postgres.ts`, then add `--apply`. Needs the old app's Docker Postgres running.
5. Connect Chat on `/service/chat` (local and live), then Import month for the current month. Live connected
   2026-11-10 (vowelweb59@gmail.com); its auto sync now writes to the live service collections, so the production
   migration (item 4) needs `--apply --replace` (the connection itself is not emptied).
6. The ops-web client secret was pasted in chat on 2026-11-10: rotate it once everything works.
7. Not exercised yet: write actions (approve, assign, edit, bulk) on real data.

## 3. Shopify App Store (Demo Store > Shopify App Store)

Goal (owner, 2026-11-10): hold **all** App Store data in this app, kept current by periodic scans, so new apps can be
designed from it (first case: FAQ apps, category `store-management-support-faq`).

| Decision | Consequence |
|---|---|
| The category tree is walked **recursively** (`crawlTree` in `lib/shopifyApps/crawlApps.ts`) | The old crawl only followed links on the 7 top-level pages, so nested categories such as FAQ (store-management > support > faq) were never read. A parent with children is no longer read as a leaf. |
| Per-app depth is stored on `ShopifyApp`: description, `features` (Shopify handles like `cf.faq.display_options.search_bar`), `plans` (name, price, note, bullets), `languages`, `worksWith` | `parseAppDeepDetail` in `lib/shopifyApps/parseApps.ts`. Labels and groups of features live in `ShopifyAppFeature`. Prices are in the crawler's currency (INR from the owner's location). |
| `DETAIL_VERSION` (crawlApps.ts) | Bump it when the reader learns to read more; every app below it is read again. Version 2 added the fields above. |
| Three reads share one running guard: **full** (tree + listings + 100 app pages, daily), **details** (200 app pages per batch while a backlog exists), **category** (one category and all its apps, on demand) | `scheduler.ts` ticks every 5 minutes (started in `instrumentation.ts`): full read once the last is 24 h old, otherwise a detail batch while apps wait. About 12,000 apps fill in over a day or two of the server being up; a free Render instance only scans while awake. |
| **Watched** categories (`ShopifyAppCategory.priority`; FAQ from the first tree read) | Their apps are read before all others and re-read after 7 days (others 30). Toggle in the category workspace. |
| FAQ is classified in the **convert** stage (`lifecycle.ts`); the rest of support stays in **retain** | A FAQ answers pre-purchase questions. One line to move. |
| Heavy per-app data is served by `GET /api/shopify-apps/category?slug=` only; the main `GET /api/shopify-apps` stays slim | Keeps the main payload small as the data grows. The category workspace (tab) shows feature coverage (click features to see which apps cover them all) and exports everything to CSV. |

Open:
1. After deploy, press **Refresh App Store** once (about 35 minutes: tree walk of ~330 categories plus listings). That creates
   the FAQ category and its ~148 apps; then **Read this category now** on FAQ (about 4 minutes) for the full data.
2. Not built yet: a searchable category browser (simpler navigation across ~330 categories) and change history over scans.

## 4. Attendance (`/attendance`)

Owner brief (2026-11-10): the attendance Chat space (`spaces/AAAA6adFMF8`, override `ATTENDANCE_CHAT_SPACE`) only announces
**leaves**, never presence. Check each person's reports in Upwork (TIMER STATUS) and the theme team (Theme Status Group) and flag
any day with nothing.

| Decision | Consequence |
|---|---|
| Mon to Fri are working days; **Sunday off; Saturday flexible, never flagged** (shown ✓ if someone reported) | `lib/attendance/grid.ts`. The owner's "alternate Saturdays are half days" is not modelled: Saturdays are optional either way. |
| Everyone is expected to report every working day unless a leave is announced | A flag is a past working day with no leave and no report in the person's own place(s). A half-day leave still expects a report. A full-day leave on a day hours were reported is flagged too ("leave but reported"). Today and later are never flagged. |
| Who is checked is **derived**, not listed: a person is active from their first report until 30 days after their last | `INACTIVE_AFTER_DAYS` in grid.ts. Leavers stop being flagged by themselves; someone who stops reporting is flagged for 30 days. Managers who never report are never checked. |
| A person in both places counts as present when either has a report | Merged by name (`matchPersonKey`): service sender `displayName` against theme `TeamMember.name` and aliases. Add an alias on the Team page if the spellings differ. |
| Leave announcements are stored raw (`attendance_messages`) and **parsed when read** (`lib/attendance/leave.ts`) | A parser fix needs no re-import. Shape: `@<team lead> <person> has applied for a leave on <date>.(<reason>)`; the @mention (position kept from the Chat annotation) is the lead, the name after it is the person. Ranges, lists, half days, numeric dates and cancellations are read; anything else lands in "Messages I couldn't read" on the page, and names with no reports in "Leaves for names not found". Only one real message was seen when this was written: check those two lists first. |
| Reads through the **Service Chat connection** (`serviceChatToken`/`serviceChatGet` exported from `lib/service/chat/google.ts`), bot posts included | The connected Google account must be a member of the attendance space. `lib/attendance/scheduler.ts` reads the last 2 months every 30 min (`ATTENDANCE_SYNC_MINUTES`), the page button the last 3. |
| This page reads **both** teams' data (read-only), an exception to section 2's "no overlap with the theme team" | It writes nothing outside `attendance_*` collections. The Service section itself is unchanged. |

Where: `lib/attendance/{leave,grid,report,chat,sync,scheduler}.ts` (pure: leave, grid; tests beside them), `models/attendance.ts`,
`app/api/attendance/**`, `app/attendance/**`, nav entry in `app/_components/shell/navItems.ts`.

Open: after deploy, open `/attendance`, press **Read attendance space now**; if it errors, the Chat account is not in that space.
Then read the two review lists and send any message shape the parser missed. Not built: company-wide holidays announced in the
space (they would show as leaves for whoever is named), per-person exclusions, a leave count report.

## 5. Adding a theme, and install-event details (Analytics)

| Decision | Consequence |
|---|---|
| Themes are **rows**, in two collections: `Theme` (Themes, Projects, Sales import and Chat time reports match on it) and `AnalyticsTheme` (Analytics; mapped to a GA4 property in Settings > GA4 Analytics) | A theme missing from either is invisible to that part of the app. `Theme` is also created by the audit ZIP upload and by creating a project with a new theme name, but nothing else adds one. |
| `npm run theme:add -- "<Name>" [--apply]` (`scripts/add-theme.ts`) adds a theme to all of it: `Theme`, its Theme Store listing (slug, presets, features, reviews, via the same handler as the Themes page's "Check Theme Store"), and an unmapped `AnalyticsTheme` linked to it | Dry run unless `--apply`; idempotent (an existing row is left alone, an unlinked analytics row gets linked). Live database: `npx tsx --env-file=.env.production.local scripts/add-theme.ts Rare --apply`, run by the owner. Ranks fill in on the next ranking check. Rare (launched about 2026-11-07) was added locally: presets Touch, Charisma, Synergy, Presence plus the default. |
| Installs on a property shared by several themes (page-path prefix each: Soft and Rare, Zeal and Noble) are counted **from the install event's own theme parameter** when the property has one, else **estimated** and shown "≈" | The install event has no page but names its theme in a custom event parameter (owner, 2026-11-10). `lib/analytics/installAttribution.ts` + `runSync.ts`: the sync finds the property's custom event parameter with "theme" in its name (metadata), counts events whose value is the theme or one of its Theme Store presets (`Theme.themeStorePresets`; run `theme:add` / "Check Theme Store" so presets exist), and stores `AnalyticsTheme.installsExactBy` / `installsExactFrom`. Installs with no theme value (before GA4 started recording it; custom dimensions are not retroactive) stay estimated from the day's Try Theme share (`installEstimateRequest` in `reports.ts`), so a range reaching back before `installsExactFrom` still shows "≈" (`installsAreEstimated` in `engine/metrics.ts`). When the parameter appears or disappears the next sync resets the theme's sync state and re-reads its full history once. The parameter must be registered in GA4 (Admin > Custom definitions, scope Event) or the Data API cannot return it. A property of its own per theme is exact with no parameter. |
| Analytics > **Installs** shows each `shopify_theme_install` event with the details it carries (store URL, store title), read **live** from GA4, not stored | `lib/analytics/installEvents.ts`: one report per GA4 property, with the property's own registered custom event parameters (`customEvent:*`, from its metadata; `lib/analytics/installDimensions.ts` picks them). GA4 returns an event parameter only when it is registered as a custom dimension (Admin > Custom definitions, scope Event); the page says so when none are. Themes sharing a property show the whole property's installs. The parameter names were never seen; they are discovered, not assumed. |

## 7. Themes page automation (owner decisions 2026-11-12; built, not yet deployed or exercised)

Scope and rationale: `docs/themes-automation-scope.md`.

| Decision | Consequence |
|---|---|
| The Themes tab shows **live themes only** (on the public Theme Store) | `Theme.themeStoreLive`, set by `syncThemesFromCatalog` (`lib/themes/syncFromCatalog.ts`) after each daily catalog read and when the page loads with undecided themes. Not live = hidden, not deleted. Nothing is marked not-live while the catalog is empty. A theme is matched by its saved `themeStoreSlug`, else the slug derived from its name, so a name that differs from its listing slug (e.g. "Home Décor") is hidden: check the list |
| The same sync fills version, release date, features, presets, reviews from the catalog | No "Check Theme Store" click needed; the button stays as a force refresh |
| Code comes from **one Git repo per theme** | `Theme.gitRepoUrl/gitBranch/gitLastCommit`, edited in the theme page's "Code source" card. `lib/themes/gitSource.ts` clones (https only), `git archive` to a ZIP, then `uploadThemeVersion`. Theme files must be at the repo root. Private repos: set `GIT_ACCESS_TOKEN` (read-only) on Render. The Dockerfile now installs git |
| Audit every theme every **48 hours, one theme at a time** | `lib/themes/autoAudit.ts` + `autoAuditPlan.ts` + `autoAuditScheduler.ts` (started in `instrumentation.ts`): every 30 min (`THEME_AUTO_AUDIT_CHECK_MINUTES`) it takes the single live theme whose last attempt is over 48 h old (oldest first), under a Mongo lease. Attempt time is stored before the audit, so a failing theme waits 48 h instead of looping; the reason shows on its page (`autoAuditError`). Interpretation of the owner's wording: each theme is re-audited every 48 h, never two at once. A free Render instance only audits while awake |
| Audit uses both live demo URLs and code | Presets: saved ones, else the demo URLs the Theme Store listing shows for each preset (saved to the theme) |
| Core Web Vitals on **every preset's demo URL**, averaged on the theme (owner, 2026-11-12), plus a per-preset check | `lib/audit/pageSpeed.ts`: every preset gets a mobile and a desktop home-page PageSpeed read in an audit (before, only the first did desktop). The Desktop/Mobile Performance cards average the presets' home pages (`computeScoreboard.ts`). The Overview's "Core Web Vitals by preset" card shows each preset's scores with **Check** (one) and **Check all**: `POST /api/themes/[id]/page-speed {url}` re-measures one saved preset and stores it on the latest complete run. **Needs `PAGESPEED_API_KEY` on Render** (not set = N/A and the error "PAGESPEED_API_KEY is not configured"). A theme with no saved demo URLs measures nothing (N/A, "no measurement was taken"): `ensureDemoPresets` (`lib/themes/ensurePresets.ts`) now fills them from the Theme Store listing in the manual Run Audit, the auto audit and the daily catalog sync. 2026-11-12 live check: Adorn, Flaunt, Dynamic had scores; Noble, Zeal, Renovate, Soft, Voltix, Rare had no URLs saved; Gravity had 2 failed PageSpeed reads |
| **Demo realism** checks (owner, 2026-11-12; step 1, rule-based, no AI) | `lib/audit/liveChecks/demoContent.ts` reads each demo page's images, visible copy (hidden elements skipped), product names and empty image slots from the HTML the live checks already fetch; `demoRealism.ts` turns that into findings `LIVE-DEMO-*` in category "Theme Store Compliance", for each preset's home page, first product page and first collection page: placeholder copy (lorem ipsum, Shopify's default brand text, "example product"), placeholder images (empty slots, `no-image`/placeholder hosts), Shopify sample snowboards and generic product names, file-name alt text, one picture filling 25%+ of a page, a collection with under 8 products, a homepage under 4 images, a product page under 3 images. They show in the findings and recommendations and as the **Demo Realism** scoreboard card (`demoRealismScoreCard` in `computeScoreboard.ts`: per preset 100 minus 25 per high, 10 per medium, 4 per low, averaged over the presets whose demo store was read; N/A when none was). They are **not** in the checks list or the Health percentage (no Requirement is seeded for them). Added the same day (owner: "skip the AI review, build everything that needs none"): `imageProbe.ts` reads the first 64 KB of up to 6 distinct photos per home and product page (`fetchPublicBytes` in `lib/net/publicUrl.ts`, SSRF-checked; `imageSize.ts` reads PNG/JPEG/GIF/WebP size) for **broken images** (404/410: `LIVE-DEMO-IMG-004`) and **photos under 600px wide** (two or more: `-005`); product **description under 50 characters or no/zero price** from the page's Product JSON-LD (`LIVE-DEMO-PRODUCT-004/005`); **all prices the same** (`-006`); a **homepage under 400 characters of text** (`LIVE-DEMO-CONTENT-004`); a **preset whose homepage reuses 80%+ of another preset's pictures** (`LIVE-DEMO-PRESET-001`, low). Adds about 4 to 6 s per theme. Checked on Renovate, Noble and Soft presets: the findings were plausible (Renovate "Portrait" shows empty image slots and "Example product title"; Noble "Glide" repeats one picture 100 times). Not built: step 2, an AI vision review of sampled images (needs an Anthropic key and costs per audit: whether a photo looks real, watermarks, AI-generated or stock pictures, whether the copy fits the niche); judging photo quality or aspect-ratio consistency |
| **Feature Availability** (Themes page): how a feature is judged, live-store check, suggestions (owner, 2026-11-12) | Three sources per feature (`featureStatus` / `featureSources` in `lib/audit/availableFeatures.ts`): (1) **code**: 38 of the 58 catalog features map to EnhancementPoint detectors that scan the theme's files; (2) **live demo store**: `lib/audit/liveFeatures.ts` (44 features) matches markup on each preset's home, first product and first collection page (inline scripts, styles and comments removed), union stored on `AuditRun.liveFeatures` by the next audit; (3) **Theme Store listing**: the feature label named in the listing, the only source for the 20 features with no detector. Seen live = confirmed (solid check); **not seen live never lowers a status** (the feature may sit behind a click or on another template). Not live-checkable: high-resolution images, animation, right-to-left, EU translations, customizable contact form, collection page navigation, swatch filters. `FeatureSuggestions.tsx` above the table: "Across themes" (features most themes lack) and "Per theme" (what a theme lacks that its siblings ship), from `lib/themes/featureSuggestions.ts`. Needs a new audit to fill the live column. Not built: turning a suggestion into a project, market adoption from EnhancementPoint data |
| **Aspire's reports are Rare's** (owner, 2026-11-12) | Mapping `MERGED_THEMES` in `lib/chat/resolve.ts`: Aspire becomes Rare; Beauty to Touch, Wellness to Synergy, Clothing to Charisma, Arts to Presence (a trailing "theme"/"preset" is ignored). `resolveTheme` applies it, so a late or re-checked report naming Aspire lands on Rare. `scripts/merge-aspire-into-rare.ts` moves the 85 existing reports (506 h) on the live database: dry run by default, `--apply` is run by the owner after a backup. It creates the missing Rare projects (Rare, Rare Touch/Charisma/Synergy/Presence as Live, Themeshopy; Rare Update if needed), links preset reports to their project, turns "Theme Update" reports into hours on Rare Update, and leaves reports with no preset named, "Collective" or an unreadable preset on Rare but unlinked for review (about 22 on the dry run). The old values are saved in `admin_audit_log` (`reports.merge_theme`, `detail.before`). **Applied on the live database 2026-11-12** (after a backup): 85 reports moved, the Rare projects created, 4 Theme Update hours entries logged (Rare Update 8.0 h), Touch 21 reports / Synergy 14 / Charisma 10 / Presence 4 linked; the 22 reports left unlinked were then linked by `scripts/link-rare-preset-reports.ts` (applied the same day; preset read from each report's Theme Name line, Collective to Charisma by the owner): Presence 10, Synergy 7, Charisma 3, Touch 2, so Rare has no unlinked preset reports. No report points at a missing project any more. Not done by this: Sales and Analytics rows that name Aspire. Also 2026-11-12: `scripts/set-presets-live.ts` set the 11 not-Live preset projects of Soft, Gravity, Nexus, Voltix and Zeal to Live |
| **Time per version** on a Theme Update project (owner, 2026-11-12) | The project page shows, per Theme Store release, the days between the previous release and it, and the days/hours the developers logged in that window (`VersionTime.tsx`, `GET /api/projects/[id]/version-time`, pure rules in `lib/projects/versionTime.ts`). Release dates come from the Theme Store's release-notes modal (`https://themes.shopify.com/themes/<slug>/presets/<slug>/modal_version_details`, parsed by `lib/themes/versionHistory.ts`), cached on `Theme.themeStoreVersions` for a day or until the listing shows a newer version. A release's window is the days after the previous dated release up to and including its own release day; time = the project's hours-log entries (`TimeEntry`, so chat-sourced and hand-entered) on those days; "Days worked" = distinct days with a report, "Effort" = hours at 8.5 h/day; work after the latest release is the "Next release" row. Versions the store lists without a date can't start a window and fall into the next dated one. Reports only exist from about July 2026, so older releases show "—". Not done: a column for this on the Projects list |
| Theme Update projects are created **automatically** | After an audit, a theme with no `theme_update` project gets "<Theme> update" with its top 5 issues as the description. One per theme, never recreated |
| Projects of non-live themes **stay**; only the Themes tab hides non-live themes (owner, 2026-11-12, after a removal had been run) | `npm run themes:remove-non-live-projects` is now **list-only** and deletes nothing. `scripts/recreate-removed-projects.ts` (one-off, already applied) re-created the 21 deleted projects |

Open: deploy; run the dry run on the live database and read the list; set each theme's Git URL (and `GIT_ACCESS_TOKEN`);
check the hidden-theme list for slug mismatches. Not built: the "Next step" column, a weekly digest, trend arrows, live-only
audits for a theme with no repo or ZIP (those show an error instead). Local Mongo was not running, so the removal script was
typechecked but not run locally.

Live dry run (2026-11-12, read-only, nothing written): 10 themes live, 14 not live (Velocity, Grocery, Breeze, Aspire, Kombat,
Pretty, Silver, Loyal, Apollo, Auto, Legacy, Krafton, Aroma, Home Décor); 21 projects and 0 time entries would be deleted.
Rare was added to the live database the same day (`theme:add Rare --apply`), making 11 live.
`--apply` was run by the owner on the live database on 2026-11-12: 21 projects and 0 time entries deleted across the 14 not-live
themes (11 live, 14 not live at that run); the themes themselves remain, hidden. The owner then said those projects should have
stayed (only the Themes tab hides non-live themes), so the same day `scripts/recreate-removed-projects.ts --apply` re-created all
21 as bare projects (name and theme only: Theme Update for the 4 "... Update" names, else Theme Design & Development in Planning;
descriptions, members, deadlines and rounds are lost). `remove-non-live-projects.ts` can no longer delete. Home Décor
(no projects) may still be a slug mismatch, so check it if it should be live.

## 6. Code audit 2026-11-11: fixes made and what remains

A read-only audit (security, stale code, duplicated mechanics) found the items below. Done on 2026-11-11 (typecheck, lint, tests pass):

| Fix | Where |
|---|---|
| A failed first Mongo connect no longer stays cached (it used to fail every request until restart) | `lib/db/connect.ts` |
| Browser-built CSV downloads use `csvCell` (formula guard, same rule as `escapeCsvField`) instead of five hand-written `cell` functions | `lib/export/csvUtil.ts`; demo-store tabs, `InstallsSection` |
| Sync interval env vars (`SERVICE_CHAT_SYNC_MINUTES`, `ATTENDANCE_SYNC_MINUTES`) are validated: empty, NaN, 0 or negative fall back to the default, minimum 1 minute | `lib/jobs/intervalMinutes.ts` |
| Boot warning when production has no `SESSION_SECRET` (or under 32 characters). Not fatal on purpose: it would lock the owner out of a deploy that predates the setting. **Owner: set `SESSION_SECRET` on Render, then this can be made fatal.** | `sessionSecretProblem` in `lib/auth/session.ts`, `instrumentation.ts` |
| A dead Google refresh token (`invalid_grant`) now marks the Service Chat connection `revoked` (schedulers skip it until reconnect) for the service and attendance syncs, as the theme sync already did | `noteIfGoogleAccessLost` in `lib/service/chat/sync.ts` |
| Theme Chat reports with no date of their own use the **IST** posting day (was UTC: a report at 00:00 to 05:30 IST got the previous day). IST helpers now live in `lib/time/ist.ts`; `lib/service/chat/months.ts` re-exports them | `lib/chat/syncSpace.ts` |
| One service import per IST month at a time, across the button, the scheduler and a second server instance: a Mongo lease (`job_leases`, `models/job-lease.ts`, `lib/jobs/lease.ts`). The busy caller gets "already running". Other schedulers (attendance, theme chat, App Store, GA4) do not use it yet | `syncServiceMonth` |
| Review approve / reject / resolve-timer only apply if the entry is still in the state it was read in, and append notes with `$push` (two people can no longer both win, notes are not lost) | `applyDecision` in `lib/service/api/review.ts` |

Second batch, 2026-11-11:

| Fix | Where |
|---|---|
| Login throttle: past the global limit (100 failures per 15 minutes) one attempt per 30 seconds gets through instead of refusing everyone (an attacker could lock the owner out); `TRUSTED_PROXY_HOPS=n` makes the per-IP key the Nth entry from the END of `x-forwarded-for` (a client can't forge it). Unset = old header order. **Owner: check Render's `x-forwarded-for` and set it.** | `lib/auth/loginRateLimit.ts` |
| The same Mongo lease now guards the theme Chat sync and the attendance sync (GA4 already has per-theme locks; the App Store crawl is long and idempotent, so it has none) | `lib/chat/syncSpace.ts`, `lib/attendance/sync.ts` |
| The theme Chat reader throws when it hits its page cap with more to read (it used to return a partial list, and the caller then moved its "last read" mark past unseen messages); it trims the Google client id/secret like the service side; the service reader reuses its access token | `lib/chat/googleChat.ts`, `lib/service/chat/google.ts` |
| Destructive theme-side actions (delete project, delete team member, clear a theme's sales, disconnect Ads) are recorded in `admin_audit_log` (what, which record, when; no "who" with one shared login). Separate from the Service section's hash-chained log. | `models/admin-audit.ts`, `lib/api/adminAudit.ts` |
| A time entry identical to one logged in the last 10 seconds is not added twice (double-click guard) | `app/api/projects/[projectId]/time/route.ts` |
| Attendance name matching strips accents like the service import ("José" = "Jose") | `lib/attendance/leave.ts` |
| README rewritten to the current app; the nine `phase-*-updated.md` specs and `ga4-analytics-architecture.md` moved to `docs/archive/`; the page-speed page no longer claims a Playwright fallback | `README.md`, `docs/archive/`, `app/page-speed/PageSpeedContent.tsx` |

Third batch, 2026-11-11:

| Fix | Where |
|---|---|
| One page fetcher for the public-site crawlers (browser User-Agent, 30 s timeout, wait and retry on 429, optional null on 404 / redirect). The App Store, Theme Store catalog and Partner Directory crawls and the Theme Store ranking read use it; the ranking read now retries a 429 (it used to fail the whole crawl) | `lib/net/fetchPublic.ts` |
| One loop helper for the three identical repeating syncs (theme Chat, service Chat, attendance). The other schedulers (GA4 rotation, demo store, ranking, Theme Store, App Store, audit recovery) have different shapes and keep their own | `lib/jobs/repeatingJob.ts` |
| Removed code nothing used: `StatusBadge.tsx`, `MUTED`, `apiRange`, `SERVICE_CLOSED_STATUSES`, `PersonUser`, a commented-out `GitThemeSource` | various |

Deliberately NOT done (each needs your call or is a larger piece of work):

- **Removed 2026-11-11 (restore from git history if ever needed):** the four October one-off scripts (`create-update-projects`,
  `classify-existing-reports`, `import-projects`, `merge-project-rounds`) with the code only they used (`lib/projects/importPlan.ts`,
  `planMerge` / `splitVersionName` in `rounds.ts`, `lib/chat/developmentSchedule.ts`, `historicalClassification.ts`) and the
  `import:projects` / `merge:rounds` npm scripts; 18 API routes no page called (`app/api/rules` and, under `app/api/service`:
  `chat/status`, `dashboard/*`, `reports/*`, `review/entries`, `review/senders` (list), `team` and `team/[id]` (read), `projects/[id]`
  (read/PATCH), `projects/[id]/details|team-hours|weekly-hours`, `projects/activity-rules|assignable-users|filter-options`; 17 in all). The
  pages read through `lib/service/api/*` directly, so nothing changed for them. Whether the scripts were ever run against the
  live database was not checked: their results are in the data either way. `data/project-import.json` (git-ignored) is now unused.
  Kept on purpose: `app/api/service/chat/disconnect` (the only way to disconnect Chat, no button yet) and the unused GET handlers
  inside routes that also have a used POST/PUT (`departments`, `users`, `projects`, `review/clients`, `review/profiles`,
  `projects/[id]/assignments|contract`).
- **Still to decide:** the legacy `demoStoreUrl` field of `/api/audit/run`, `lib/service/import/contract-events.ts` (only its test
  uses it), `pg` and the Postgres migration script (after production is migrated, item 4 of section 2).
- **One Google Chat client for the three copies** (OAuth code exchange, paging, callbacks, connection schema): large; the bugs the
  copies had (token reuse, truncation, trimming, revoked tokens) are fixed individually above.
- **One API helper for the 94 theme-side routes** (`lib/service/api/http.ts` is the model): migrate route by route when each is next
  touched; 41 have no try/catch and some echo `err.message` to the client.
- **Shared date helpers beyond IST** (`addDays`, `daysBetween` with four meanings, month bounds) and one HTML entity decoder.
- **Review hand-offs:** the 14 vs 30 day "inactive" cutoff (theme team activity vs attendance) is undecided.
