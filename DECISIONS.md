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

Still open from the audit, in order: login throttle trusts client IP headers and has a global cap that can lock the owner out;
sync lease for the other schedulers; one scheduler helper (9 hand-rolled loops); one Google Chat client for the three copies
(token caching, page limits, silent truncation in the theme reader, credential trimming in the theme side); shared name
normalizer (accents); shared crawler fetch layer; generic API helper for the 94 theme-side routes; audit trail for theme-side
deletes; time-entry double-click guard; stale docs (README, `phase-*-updated.md`, Playwright text on the page-speed page);
`scripts/import-sales.ts` is untracked but `sales:import` needs it; dead `app/api/service/*` GET routes and one-off scripts
(`create-update-projects`, `classify-existing-reports`, `import-projects`, `merge-project-rounds`) need an owner check first.
