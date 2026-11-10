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
