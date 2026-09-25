# GA4 Analytics — Architecture

Status: **All 8 phases code-complete.** OAuth, theme mapping, the GA4 → MongoDB sync, the analytics engine and APIs, the dashboard, and the deep analytics pages are built and hardened (§9). **Not yet verified against real Google:** the live OAuth → GA4 flow is waiting on the Google Cloud Console setup (§8.1). Everything else is tested against fakes and synthetic data.

---

## 1. The existing application (audit findings)

| Area | What exists today | What it means for GA4 |
|---|---|---|
| Framework | Next.js 16.3 App Router, React 19, Tailwind v4. Route handlers in `app/api/**/route.ts`. | GA4 APIs go under `app/api/analytics/**`. There's no separate backend. |
| Auth | `proxy.ts` (Next 16's renamed middleware) adds an opt-in HTTP Basic Auth gate for the whole app when `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` are set. There are no user accounts. | That gate is the only authorization boundary. Every GA4 route is behind it automatically. Nothing per-user is needed (single-team internal tool). |
| Database | MongoDB via Mongoose 9. `lib/db/connect.ts` caches one connection on `globalThis`. Models use the `models.X ?? model("X", schema)` idiom. Cascades are emulated with `pre("deleteOne")` hooks (`models/theme.ts`). | New models follow the same idiom. There's no migration framework: Mongoose builds the declared indexes on first model use (`autoIndex`). |
| Existing Google OAuth | Sheets export only: `lib/google/oauth.ts` plus `app/api/auth/google/*`. `models/google-auth.ts` is a **singleton**: the callback runs `deleteMany({})` and then inserts, so a new connect replaces the old one. Tokens are stored as **plain text**. The scopes are Sheets, drive.file and email. | This can't carry multi-account GA4, so GA4 gets its own `GoogleConnection` model and routes. The Sheets flow stays untouched. The GA4 flow reuses the same OAuth *client* (`GOOGLE_CLIENT_ID`/`SECRET`) with a separate callback. |
| Background jobs | `instrumentation.ts` starts `setTimeout` schedulers at boot (`lib/demoStore/scheduler.ts`, `lib/themes/rankingScheduler.ts`). Each is guarded against hot-reload duplication on `globalThis`, and its next-run state is persisted in a Mongo singleton. | The scheduled GA4 sync (Phase 4) follows this pattern. It's only safe with **one** server process. If the deployment is ever scaled out, the `AnalyticsSync` lock (below) stops two replicas from running the same theme's sync twice, but each replica would still wake up. |
| Error handling | Route handlers use try/catch and return `{ error }` JSON with a status code. `lib/api/validation.ts`'s `isValidObjectId` turns malformed ids into a 400. OAuth errors redirect back to `/settings?google=error&googleError=...`. | Reuse all three. |
| Logging | `console.error` with a `[module]` prefix. There's no structured logger. | Same. Never log tokens or full Google error bodies (they can echo request data). |
| UI kit | `app/_components/ui/` (Button, Card, EmptyState, Modal, StatusBadge, Table), the shell (`AppShell`, `Sidebar`, `NAV_ITEMS` in `shell/navItems.ts`), `TabbedPage`, and a hand-rolled SVG `LineChart` (`app/themes/[themeId]/_components/`). No chart library. | Phase 6 builds on these. It adds one nav item and one route tree (`/analytics`). |
| Tests | Vitest in a node environment. Colocated `*.test.ts`. No DB in tests. | Model tests are schema-level (`validate()`, declared indexes); lifecycle tests hit a real Mongo only when `GA4_TEST_MONGODB_URI` is set. See `lib/analytics/models.test.ts`. |
| Deployment | A single `Dockerfile` (`node:22-slim`, Next standalone output, `node server.js`; no browser since PDF export moved to browser print). The live app runs on **Render** (`shopify-theme-reviwer.onrender.com`) with its own MongoDB. `docker-compose.yml` is local Mongo only. | **Confirmed hosting: Render** (the GA4 brief's "Railway" was a mistake). Production `APP_URL` = `https://shopify-theme-reviwer.onrender.com`, and the GA4 callback registered on the OAuth client = `https://shopify-theme-reviwer.onrender.com/api/analytics/google/callback`. The new env vars must be set in Render's dashboard. |
| Existing `Theme` model | `models/theme.ts` = an uploaded, audited theme ZIP (production has the same 9 names: Adorn … Zeal). | Kept separate (see §3.1). It's linked optionally through `AnalyticsTheme.themeId`. |

---

## 2. GA4 architecture

```text
Google account A ─┐                      ┌─> AnalyticsTheme (Adorn → property 123…)
Google account B ─┼─ OAuth (Phase 2) ──> GoogleConnection (one row per account)
Google account C ─┘                      └─> AnalyticsTheme (Dynamic → property 456…)
                                                   │
                         GA4 Data API (Phase 4, server-side only)
                                                   ▼
                        AnalyticsSync (job + per-theme lock) ──> AnalyticsAggregate rows
                                                   │
                        lib/analytics engine (Phase 5): KPIs, rates, comparisons
                                                   ▼
                        app/api/analytics/* JSON ──> /analytics dashboard (Phase 6–7)
```

Rules the design enforces:

- **The browser never talks to Google.** Tokens live only in MongoDB, encrypted and excluded from queries by default (`select: false`). React only calls `app/api/analytics/*`.
- **Themes are rows, not code.** The 9 current themes will be *seeded* (Phase 3). Adding a tenth is an insert through the UI.
- **Dashboard reads come from Mongo.** GA4 is read by the sync jobs. The one planned exception is range-level unique users (§4).

### Module layout (✓ = built)

```text
lib/analytics/
  constants.ts        events, breakdowns, dims key     ← Phase 1
  crypto.ts           AES-256-GCM token encryption     ← Phase 2 ✓
  googleOAuth.ts      consent URL, code exchange, id-token verify, error classes ← Phase 2 ✓
  googleConnections.ts save/list/validate/disconnect, getAuthorizedClient() ← Phase 2 ✓
  oauthState.ts       CSRF state cookie, post-OAuth redirect ← Phase 2 ✓
  properties.ts       GA4 Admin API: list accessible properties, get one ← Phase 3 ✓
  themes.ts           theme CRUD, mapping validation, discovery with 'already mapped' flags ← Phase 3 ✓
  sync/dates.ts       property-time-zone dates, chunking ← Phase 4 ✓
  sync/ga4Client.ts   Data API runReport: pagination, momentary retries, error/quota classification ← Phase 4 ✓
  sync/reports.ts     which reports a chunk runs; GA4 rows → aggregate rows ← Phase 4 ✓
  sync/runSync.ts     plan / lock / execute / resume / retry jobs ← Phase 4 ✓
  sync/scheduler.ts   15-min tick from instrumentation.ts ← Phase 4 ✓
  sync/kickoff.ts     start a sync right after a property is mapped ← Phase 4 ✓
  engine/dateRanges.ts presets, custom ranges, previous period, in property time zone ← Phase 5 ✓
  engine/filters.ts   filter params → GA4 dims, which breakdown answers a request ← Phase 5 ✓
  engine/kpis.ts      KPIs, rates, comparison, daily series (pure, unit-tested) ← Phase 5 ✓
  engine/uniqueUsers.ts range-level unique users from GA4, cached (AnalyticsRangeUsers) ← Phase 5 ✓
  engine/params.ts    query-string validation for the metrics routes ← Phase 5 ✓
  engine/metrics.ts   service: Mongo reads + engine → overview/themes/trends/breakdown/events ← Phase 5 ✓
app/api/analytics/
  google/connect, google/callback, google/connections[/:id/validate|disconnect] ← Phase 2 ✓
  themes, themes/:id (PATCH), themes/:id/validate|disconnect, google/connections/:id/properties ← Phase 3 ✓
  themes/:id/sync (POST), themes/:id/syncs, sync (latest per theme) ← Phase 4 ✓
  metrics/overview|themes|trends|breakdown|events (GET) ← Phase 5 ✓
  metrics/journey (GET) ← Phase 7 ✓
app/analytics/page.tsx + _components/  main dashboard: controls, KPI cards, funnel, trends, theme comparison ← Phase 6 ✓
app/analytics/layout.tsx  shared shell: controls, filter bar, section links ← Phase 7 ✓
app/analytics/geography|acquisition|technology|pages|events|journey ← Phase 7 ✓
```

---

## 3. Database design

The five new collections (four from Phase 1, plus `AnalyticsRangeUsers` from Phase 5, a unique-users cache, see §5d) are all additive. No existing collection or document is modified.

### 3.1 `AnalyticsTheme` (`models/analytics-theme.ts`)

| Field | Notes |
|---|---|
| `name`, `slug` | `slug` is unique, lowercase and kebab-case |
| `themeId` → `Theme` | Optional link to the audited theme of the same name |
| `googleConnectionId` → `GoogleConnection` | Which account can read the property |
| `ga4PropertyId` | Numeric id only (`123456789`). Unique across themes (partial index, so any number of unmapped themes can have `null`) |
| `ga4PropertyDisplayName`, `ga4PropertyTimeZone` | The time zone is needed because GA4 dates are property-local (§4) |
| `connectionStatus` | `unmapped` / `connected` / `error`. A mapping is validated *before* it's saved, so there's no pending state. The API reports the Google account's own status next to it |
| `isActive` | Hides a theme without deleting its history |
| `lastValidatedAt` | When the mapping was last proved readable |
| `historyStartDate`, `syncedThroughDate`, `lastSuccessfulSyncAt`, `lastError` | Sync bookkeeping, owned by Phase 4 |

**Why not add GA4 fields to the existing `Theme`?** That model is an audited ZIP with a cascade-delete tree (runs, findings, GridFS). Analytics and audit lifecycles are independent: a theme can be tracked but never audited, and deleting an audit theme mustn't delete analytics history. The optional `themeId` link gives the side-by-side view without coupling them.

### 3.2 `GoogleConnection` (`models/google-connection.ts`)

One row per Google account, keyed by `googleAccountId`: the OIDC `sub`, which is unique and, unlike email, never changes. A reconnect of the same account updates its row. Connecting a different account adds a row. `encryptedAccessToken`/`encryptedRefreshToken` are `select: false`. `status` is `active` | `revoked` | `error` | `disconnected`. Disconnecting keeps the row (status `disconnected`, tokens cleared) so mapped themes keep a readable owner and their history.

### 3.3 `AnalyticsSync` (`models/analytics-sync.ts`)

This is both the job record and the lock.

- `syncType`: `initial` | `incremental` | `manual` | `scheduled`. `status`: `queued` | `running` | `succeeded` | `failed` | `cancelled`.
- `ga4PropertyId` is snapshotted at job time.
- `rangeStart`/`rangeEnd` are `YYYY-MM-DD` strings.
- Retry state: `attempt`, `maxAttempts`, `nextRetryAt`. Error state: `error.{message,code}`. Counters: `rowsFetched`, `rowsUpserted`.
- **Overlap prevention:** `isActive: true` while queued or running, and a partial unique index on `{analyticsThemeId}` where `isActive: true`. A second concurrent job for the same theme fails at insert, which is atomic even across processes. A boolean is used instead of `status: {$in: [...]}` because `$in` in partial indexes needs MongoDB ≥ 6.0 and the hosted version isn't pinned.
- The last successful sync per theme is denormalized onto `AnalyticsTheme`, so the dashboard doesn't have to scan jobs.

### 3.4 `AnalyticsAggregate` (`models/analytics-aggregate.ts`)

These are cached report rows, never raw events. One row is: theme × date × breakdown × event × one set of that breakdown's dimension values.

| Breakdown | GA4 dimensions (besides `date`, `eventName`) |
|---|---|
| `total` | none |
| `country` | `country` |
| `city` | `country`, `city` |
| `device` | `deviceCategory` |
| `browser` | `browser` |
| `os` | `operatingSystem` |
| `acquisition` | `sessionSource`, `sessionMedium`, `sessionCampaignName` |
| `channel` | `sessionDefaultChannelGroup` (added in Phase 7: GA4's own channel grouping, which can't be derived from source/medium) |
| `landingPage` | `landingPage` |
| `page` | `pagePath` |

Metrics: `eventCount`, `totalUsers`, `activeUsers`, `newUsers`, `sessions`. `eventName` is either a tracked event or `(all)` for property-wide user and session totals.

**Why breakdowns and not one row per full combination:** GA4 allows at most 9 dimensions per report and collapses high-cardinality combinations into `(other)`. A full 12-dimension cross product is neither requestable nor storable. It's also most of the "unnecessary raw data" the brief says to avoid.

Indexes:

- Unique `aggregate_row_identity` `{analyticsThemeId, date, breakdown, eventName, dimsKey}` makes re-syncs idempotent upserts.
- `dimsKey` is `buildDimsKey()`'s flattened, order-fixed string. A subdocument can't be used as a reliable unique key.
- `{analyticsThemeId, breakdown, eventName, date}` serves single-theme reads.
- `{breakdown, eventName, date}` serves All Themes reads.

### Relationships

```text
GoogleConnection 1 ── * AnalyticsTheme * ── 0..1 Theme (audit)
                             │ 1
                             ├── * AnalyticsSync
                             └── * AnalyticsAggregate (each row also → its AnalyticsSync)
```

---

## 4. Analytics correctness constraints (binding on Phases 4–7)

1. **Unique users are not additive.** `eventCount` and `sessions` sum correctly across days and themes. `totalUsers` doesn't: summing 30 daily rows counts a returning user up to 30 times. So these can come from daily rows:
   - trends (users per day),
   - event counts over any range,
   - a user-days figure.

   A true "unique users over the last 30 days" figure can't. Phase 5 has to either query GA4 for range-level unique counts (cached per theme/range/breakdown) or precompute them for the standard presets during sync. The recommendation is the on-demand cache: it covers custom ranges too.
2. **Unique users across themes can't be deduplicated.** Each theme is a separate property, and GA4 has no shared user id across properties. An "All Themes" user count is a *sum of per-theme users* and must be labelled that way.
3. **Conversion rates are aggregate ratios, not journeys.** "Try Theme → Install" means install users ÷ try-theme users in the same period. It doesn't mean the same people did both in that order. Only GA4's funnel report (`runFunnelReport`, currently a v1alpha Data API method) measures true step-by-step sequences. If Phase 7 uses it, it has to be labelled as such, and it carries alpha-API stability risk.
4. **Dates are property-local.** GA4 buckets events by the property's time zone. Stored dates stay in that zone, and presets like "Today" and "This week" must be computed in it. Themes in different time zones don't line up exactly on "Today" in All Themes view.
5. **Recent days change.** GA4 keeps processing the last ~72 hours. Incremental syncs re-fetch a trailing window before `syncedThroughDate` and upsert over it.
6. **Thresholding and `(other)`.** GA4 may withhold small counts (data thresholds when Google signals is on) or roll rare values into `(other)`. The sums of a breakdown can therefore differ slightly from its `total` row. The UI should say so instead of hiding it.
7. **History.** The Data API serves aggregated data back to the property's creation date: the Admin API's `createTime`, never before 2015-08-14. It isn't limited by the 2- or 14-month event-data retention setting, which only affects Explorations. The initial sync must be chunked and throttled against the per-property daily token quota.

---

## 5. Environment configuration

The placeholders are in `.env.example`, now tracked in git through a `!.env.example` exception in `.gitignore`. Real values go in `.env.local` (local) and Render's environment settings (production).

| Variable | Status | Purpose |
|---|---|---|
| `MONGODB_URI` | existing | Same database, new collections |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | existing (shared) | The same OAuth client is reused for GA4 |
| `GOOGLE_REDIRECT_URI` | existing | Sheets callback only. Not reused |
| `APP_URL` | **new** | Public base URL, used to build the GA4 callback |
| `GA4_OAUTH_REDIRECT_URI` | **new**, optional | Defaults to `${APP_URL}/api/analytics/google/callback`. It must be registered on the OAuth client |
| `ANALYTICS_TOKEN_ENCRYPTION_KEY` | **new** | 32 random bytes, base64. Encrypts stored tokens. Rotating it forces every account to reconnect |

Google Cloud prerequisites for Phase 2/3: enable the **Google Analytics Data API** and the **Google Analytics Admin API**. Add the GA4 callback URI. Plan for the read-only scope `https://www.googleapis.com/auth/analytics.readonly`, plus `openid email`. While the consent screen is in "Testing" mode, every Google account that will connect must be listed as a test user. In Testing mode, refresh tokens also expire after 7 days, which matters for the multi-account setup.

---

## 5a. Phase 2: how the OAuth flow works

1. `GET /api/analytics/google/connect[?connectionId=]` sets an httpOnly `ga4_oauth_state` cookie (10 min, scoped to `/api/analytics/google`) and redirects to Google. The request uses `prompt=select_account consent`: the account chooser makes a *second* account possible, and forced consent guarantees a refresh token. A reconnect passes that account's email as `login_hint`.
2. `GET /api/analytics/google/callback`:
   - `error=access_denied` means the user cancelled.
   - If the state doesn't match the cookie, the callback is rejected (CSRF protection).
   - Otherwise it exchanges the code, verifies the id token (the `sub` claim is the identity) and requires that `analytics.readonly` was actually granted, since Google lets users untick scopes.
   - It upserts by `googleAccountId` and always redirects to `/settings?tab=analytics&ga4=connected|reconnected|cancelled|error`.
3. **Validate** forces a refresh-token grant. `invalid_grant` sets status `revoked` and deletes the dead tokens. `invalid_client` sets `error`. Network or 5xx failures change no status and only set `lastError`.
4. **Disconnect** deletes the tokens and keeps the row. It deliberately does **not** revoke at Google: the Sheets export shares the OAuth client, and Google revokes a whole client grant at once. To fully remove access, go to myaccount.google.com/permissions.
5. `getAuthorizedClient(connectionId)` is what Phase 3+ uses for API calls. It refreshes automatically and re-encrypts refreshed tokens back into Mongo.

**Google Cloud setup still to do** (project that owns `GOOGLE_CLIENT_ID`):
- Clients → the OAuth client → Authorized redirect URIs: add `http://localhost:3000/api/analytics/google/callback` and `https://shopify-theme-reviwer.onrender.com/api/analytics/google/callback`. Add them; don't replace the existing Sheets URIs.
- Data Access: add the `.../auth/analytics.readonly` scope.
- Audience: while in Testing mode, add each Google account that will connect as a test user. In Testing mode, refresh tokens die after 7 days.
- Library: enable the Google Analytics Admin API (Phase 3) and Data API (Phase 4).
- Render → Environment: set `APP_URL=https://shopify-theme-reviwer.onrender.com` and a new `ANALYTICS_TOKEN_ENCRYPTION_KEY`. Use a *different* key from local.

## 5b. Phase 3: property discovery and theme mapping

- **Discovery:** `GET /api/analytics/google/connections/:id/properties` calls the Admin API's `accountSummaries.list` (paginated) and returns every ordinary GA4 property the account can see: property id, name, and GA account. Each one is flagged with the theme already using it. Roll-up and sub-properties (GA360) are skipped.
- **Add theme:** name → Google account → property → **Validate & save**. Server-side, the save:
  1. rejects a property that's already mapped (409),
  2. rejects an inactive account (422),
  3. calls `properties.get` through that account,
  4. only then stores the mapping with the property's display name and **time zone**.

  If any step fails, nothing is saved.
- **Edit:** a rename keeps the slug, so the slug stays a stable id. Changing the property re-validates it and resets the sync bookkeeping (`historyStartDate`/`syncedThroughDate`/`lastSuccessfulSyncAt`), because that belongs to the old property.
- **Validate:** re-checks a saved mapping. Loss of access or a deleted property sets `error`. A Google outage only records `lastError`. If Google rejects the token outright, the *account* is marked `revoked`.
- **Disconnect:** unmaps the theme, which stays as a row, and frees the property for another theme.
- **Seeding:** `npm run seed:analytics-themes` is idempotent. It creates the 9 themes as `unmapped` and links each to the audited `Theme` with the same name. It never changes an existing theme's name or mapping. **Run it once against production** (Render's MongoDB), or add the themes by hand in the UI.
- **Error mapping:** Admin API failures become safe messages (`not_found`, `permission_denied`, `api_disabled` = Admin API not enabled in the Cloud project, `auth_revoked`, `unavailable`). Google's raw error text is never shown.
- **Not built (not in the brief):** deleting a theme or toggling `isActive` in the UI.

## 5c. Phase 4: the sync pipeline

**Reports per chunk.** Each breakdown in §3.4 runs two reports, so 20 requests per chunk (18 before Phase 7 added `channel`):
- **events:** `date × eventName × dims`, filtered to the 12 tracked events. Metrics: `eventCount`, `totalUsers`, i.e. the unique users who fired that event that day.
- **totals:** `date × dims` across all events. Metrics: `totalUsers`, `activeUsers`, `newUsers`, `sessions`, `eventCount`. Stored as `eventName: "(all)"`.

They're kept separate because users who fired *any* event can't be derived by adding per-event users together.

**Job lifecycle** (`AnalyticsSync`):
1. **Plan:**
   - The first sync of a property (`syncedThroughDate` null) is `initial`. It runs from the property's creation date in its own time zone (Admin API `createTime`) to property-local today, never earlier than 2015-08-14 or the optional `ANALYTICS_HISTORY_START_DATE`.
   - Later syncs are `manual` or `scheduled` and cover `syncedThroughDate − 3 days` → today, since GA4 revises the last ~72 hours.
2. **Lock:** the job is inserted with `isActive: true`. The partial unique index makes a second active job for the same theme fail at insert, which surfaces as a 409. "Sync now" on a job that's waiting to retry resumes it instead.
3. **Execute:** the job works in 30-day chunks, oldest first. Each report's rows are bulk-upserted on `aggregate_row_identity`, so re-runs are idempotent.
   - After a chunk completes, rows for those dates *not* written by this job are deleted. That's how a GA4 revision that removes a value, e.g. traffic re-attributed to another country, stops showing.
   - Only then do `cursorDate`, `chunksDone` and the theme's `syncedThroughDate` advance.
   - Each chunk first re-checks that the theme still points at the job's property. If it's been remapped, the job ends as `cancelled`.
4. **Failures:**
   - *Momentary* ones (5xx, network, generic 429) are retried inside the request: 3 tries with backoff.
   - *Retryable* job failures re-queue the job from its cursor, with `nextRetryAt` set by kind: outage 5 → 15 → 45 min, up to 3 attempts; hourly quota +65 min; daily quota every 6 h. Quota waits don't use up an attempt.
   - *Permanent* failures mark the job `failed` and release the lock. Lost access or a deleted property also marks the theme `error`. `invalid_grant` marks the Google account `revoked`.
   - Data-quality flags (thresholding, `(other)` rows) are stored as job `warnings` and shown in the UI.
5. **Recovery:** at boot, every `running` job is re-queued, because the process that ran it is gone. On each tick, `running` jobs untouched for 30 min are re-queued too. Every report write refreshes `updatedAt` as a heartbeat.
6. **The first sync of a newly mapped property also purges** that theme's rows from any previous property.

**Triggers:**
- Mapping a property through the API starts its initial sync in the background.
- "Sync now" is `POST /api/analytics/themes/:id/sync`, which answers 202 while the UI polls `GET /api/analytics/sync`.
- The scheduler ticks every 15 minutes. It runs due retries, then starts a `scheduled` sync for every mapped, connected theme with no attempt in the last 6 hours, one job at a time. `ANALYTICS_SYNC_DISABLED=1` turns it off.

## 5d. Phase 5: the analytics engine

**APIs** (all `GET /api/analytics/metrics/*`, all read MongoDB; only unique users may call GA4, see below):

| Route | Returns |
|---|---|
| `overview` | Users, sessions, new users, Theme Views / Try Theme / installs (each as `count` and `users`), the five conversion rates, current vs previous |
| `themes` | The same KPI set per theme (theme comparison table) plus the All Themes total |
| `trends` | Daily users, sessions, Theme Views, Try Theme, installs; previous period aligned day by day |
| `breakdown` | KPIs per value of one dimension (`dimension=country\|city\|device\|browser\|os\|source\|medium\|campaign\|landingPage\|page`), sorted (`sort`, `order`) and paginated (`limit` ≤ 100, `offset`) server-side |
| `events` | Count and users for all 12 tracked events, primary events first |

Common query: `theme=all|<id or slug>`, `range=today|yesterday|last7|last30|last90|thisWeek|lastWeek|thisMonth|lastMonth|thisYear|custom` (+ `start`, `end`), `compare=previous|none`, `events=<extra tracked events>`, and filters `country city device browser os source medium campaign landingPage page`. Every response carries `meta`: resolved ranges per theme, `usersBasis`, `usersScope`, `warnings` and `notes`. Bad input is a 400 with a readable message; an unknown theme is a 404.

**Date ranges** follow GA4's UI so numbers can be checked against it: "Last N days" end yesterday, weeks start on Sunday, and the comparison is the *preceding period* (same length, immediately before). Presets resolve in each property's time zone. In All Themes, themes in different zones get their own dates (`meta.mixedTimeZones`), and trends line up by day index, not by date string.

**Users (§4.1).** Range-level unique users come from GA4 on demand: two small reports (`totalUsers` overall, and per event), with the same filters and grouping as the request. They're cached in `AnalyticsRangeUsers`: 1 hour for ranges touching the last 3 days, 30 days for settled ranges, cleaned up by a TTL index. If the account isn't active, GA4 fails or times out (10 s), or `ANALYTICS_UNIQUE_USERS_DISABLED=1`, users fall back to summed daily users. The response then says `usersBasis: "daily_sum"` and names the themes in a warning. Event counts, sessions and new users always come from MongoDB. All Themes users are a sum of per-theme users (`usersScope: "sum_of_themes"`).

**Rates** are `users ÷ users × 100` from the brief. They're `null` when the denominator is 0 (not 0%), can exceed 100%, and are always recomputed from summed counts, never averaged. `meta.notes` carries the "not a journey" disclaimer.

**Filters** combine within one dimension family: country + city, or source + medium + campaign. A cross-family combination such as country + device is a 400, because no stored row carries both (§7). When the fallback has to add up several stored rows per day (e.g. source alone sums its mediums), a warning says the users may double-count.

## 5e. Phase 6: the main dashboard

`/analytics` (nav item "Analytics"). Everything on it comes from the metrics API. The components only format and lay out the numbers.

- **Global controls** sit in one row: theme (All Themes plus every active theme from the database; unmapped ones are listed but disabled), date range (all 11 presets, with date pickers and Apply for a custom range), and a "compare with previous period" checkbox. They live in the URL (`?theme=&range=&start=&end=&compare=`), so views can be bookmarked and the back button works. The URL uses the same parameter names the API takes.
- **Two requests per filter change:** `metrics/themes` feeds both the KPI cards (from its `total`) and the comparison table (its per-theme rows), and `metrics/trends` feeds the charts. A newer request aborts the one in flight. The previous data stays on screen, dimmed, while the next loads.
- **KPI cards:** Users, Theme Views, Try Theme, Theme Installs, Install Rate. Each shows the change vs the previous period as an arrow plus text: neutral colours, never colour alone. The status colours stay reserved for pass/fail. The Users card says whether it's unique or summed-daily users, and whether it's summed across themes.
- **Funnel:** Users → Theme Views → Try Theme → Installs as bars scaled to Users. Each step shows the engine's ratio ("÷ theme views"), never "converted". This needed one engine addition, `rates.themeViewRate`.
- **Trends:** one small chart per metric, each with this period and the previous period overlaid day by day. A toggle switches between unique users per day and event counts. They reuse the existing `LineChart`, which gained an optional `yFloor` so count axes never go negative.
- **Theme comparison** (All Themes only): Theme | Users | Views | Try Theme | Installs | Install Rate, each with its change. Columns are sortable, and clicking a row narrows the dashboard to that theme.
- **States:** skeletons on first load; an empty state linking to Settings → GA4 Analytics when no theme is mapped; error states with retry (and "Show All Themes" for an unknown theme). The engine's `warnings` go in an info callout and its `notes` in the small print.
- **Responsive:** checked at 390 px and desktop widths. The KPI grid goes 2 → 3 → 5 columns, the table turns into stacked cards on narrow screens, and funnel bars sit on their own full-width track.

## 5f. Phase 7: deep analytics, filters and the journey

- **Pages** (`/analytics/*`, one shared layout):
  - **Overview** (§5e).
  - **Geography:** country, city.
  - **Acquisition:** channel, source, medium, campaign; sorted by installs by default.
  - **Technology:** device, browser, OS.
  - **Pages:** landing page, page.
  - **Events.**
  - **Journey.**
- **The shared layout** holds the header, the global controls, a filter bar and section links that carry the current URL state along.
- **Breakdown tables** (`BreakdownTable`): Users, Theme Views, Try Theme, Installs and Install Rate, each with its change vs the previous period. Sorting and pagination are server-side (25 rows a page), so only one page ever reaches the browser. There are loading and empty states, and stacked cards on phones. One table is shown per section at a time, so a page load is one request.
- **Filters:** every row has a "Filter" action that adds its value(s) to the URL. A city row adds country + city. Every page and endpoint honours the filters, including the Overview's KPIs, trends and comparison table. The **Extra event** filter adds one supporting event to every table (`events=` in the API) and highlights it on the Events page. Active filters show as removable chips. Cross-family combinations are handled as described in §7.
- **Events:** Theme Install and Try Theme (plus Theme View) lead as cards; the ten supporting events follow in a compact table, so generic events never dominate.
- **Journey** (`GET /api/analytics/metrics/journey`, engine `journeySteps`): Session (`session_start`) → Page View → Theme View → Try Theme → Theme Install. Each step is the users who fired that event, with the ratio to the previous and first step and the previous-period change. The "not a sequence" caveat is the API's first note and is shown at the top of the page, not in small print.
- **Sync change:** the new `channel` family adds 2 reports per sync chunk. Rows synced before it have no channel rows. The first real sync hasn't run yet, so nothing needs backfilling.
- **Measured locally** against about 280k synthetic rows (3 themes × 120 days × every family): warm breakdown requests took 0.1–1 s, and a 25-row page is about 70–85 KB of JSON. Both are Phase 8 performance-review items.

## 6. Integration points by phase

| Phase | Touches |
|---|---|
| 2 OAuth | `GoogleConnection`, `lib/analytics/crypto.ts`, `app/api/analytics/google/*`, a connections section (on `/settings` or `/analytics/settings`) |
| 3 Properties + themes | `AnalyticsTheme`, Admin API `accountSummaries.list`, a seed script for the 9 themes (`scripts/seed-analytics-themes.ts`, the same idempotent pattern as the existing seeds) |
| 4 Sync | `AnalyticsSync`, `AnalyticsAggregate`, a scheduler registered in `instrumentation.ts` |
| 5 Engine | Pure functions over aggregate rows plus the range-unique-users cache (§4.1) |
| 6–7 Dashboard | `NAV_ITEMS`, `/analytics/*`, the existing UI kit and `LineChart` |
| 8 Hardening | This document becomes the final setup and operations guide |

## 7. Known limitations (by design, so far)

- Filters combine exactly *within* a breakdown (source + medium + campaign; country + city). They don't combine *across* breakdowns (country + device) from cached rows. **Decided in Phase 7: not supported.** Supporting it would need either paired breakdowns (each one multiplies storage) or a live GA4 query on every page load, which the brief rules out. The API answers such requests with a 400, and the UI never builds one: adding a filter from another family replaces the current filters, and a table that can't be answered says so with a "Remove filters" button.
- The user journey is aggregate step counts, not sequences. GA4's `runFunnelReport` (true sequences) is a v1alpha Data API method that needs a live GA4 call. It wasn't used.
- Single-process scheduler (see §1).
- **Storage.** The page and landing-page breakdowns grow with distinct pages × tracked events × days. A theme with ~50 active pages and three years of history can reach a few hundred thousand rows. Check the real row count after the first production syncs. `ANALYTICS_HISTORY_START_DATE` caps history if the hosted MongoDB plan is small.
- No MongoDB-backed integration test yet. Index creation is verified against the declared schema, not a live server.

---

## 8. Operations guide

### 8.1 First-time setup

1. **Google Cloud** (the project that owns `GOOGLE_CLIENT_ID`; Console → Google Auth Platform):
   - **Clients** → the OAuth client → *Authorized redirect URIs*. **Add** these; don't replace the Sheets URIs:
     - `http://localhost:3000/api/analytics/google/callback`
     - `https://shopify-theme-reviwer.onrender.com/api/analytics/google/callback`
   - **Data Access:** add `https://www.googleapis.com/auth/analytics.readonly`.
   - **Audience:** while the app is in *Testing*, add every Google account that will connect as a test user. Testing-mode refresh tokens expire after 7 days, so publish the app, or expect to reconnect weekly.
   - **Library:** enable the **Google Analytics Admin API** and the **Google Analytics Data API**.
2. **Environment** (`.env.local` locally; Render → Environment in production). See `.env.example`.
   - `APP_URL`
   - `ANALYTICS_TOKEN_ENCRYPTION_KEY`: 32 random bytes, base64, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Use a different key per environment. **Never rotate it casually:** every account then has to reconnect.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (already there for Sheets).
   - `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`: see §9.1. **These must be set in production.**
3. **Seed the themes:** `npm run seed:analytics-themes`, once per database, including Render's MongoDB. It's idempotent.
4. **Connect accounts:** Settings → GA4 Analytics → *Connect Google account*. Repeat for each account that owns properties.

### 8.2 Adding a theme and mapping its property

Settings → GA4 Analytics → *Add theme*: name → Google account → GA4 property → **Validate & save**. The app proves the account can read the property before saving. Its full history then syncs in the background (§5c). To move a theme to another property, use *Edit*: the old property's rows are purged by the new property's first sync. A new theme needs no code change.

### 8.3 Sync

- **Automatic:** every 15 minutes the scheduler syncs each connected theme that hasn't been attempted in 6 hours.
- **Manual:** *Sync now*. It can't cut short a wait for GA4's API quota to reset (it answers 409 with the resume time).
- **Recent days are re-fetched:** every sync covers the last 3 days again, because GA4 revises them.
- **Turning it off:** `ANALYTICS_SYNC_DISABLED=1` turns the scheduler off (manual sync still works). `ANALYTICS_UNIQUE_USERS_DISABLED=1` stops the dashboard asking GA4 for range-level unique users; users then show as summed daily figures, labelled as such.

### 8.4 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` after *Connect* | The callback URI isn't registered on the OAuth client (§8.1 step 1). |
| "Your Google account didn't grant Analytics access" | The user unticked the analytics scope on Google's consent screen. Connect again and leave it ticked. |
| Account shows **revoked** | The refresh token died: removed at myaccount.google.com/permissions, 7-day Testing-mode expiry, or a password change. Click *Reconnect*. |
| Theme shows **error** | The account lost access to the property, or the property was deleted. Fix access in GA4 Admin, then *Validate*. |
| Sync stuck "waiting to retry" | A GA4 outage or quota (the job shows the code). It resumes on its own: 5→15→45 min for outages, +65 min for the hourly quota, every 6 h for the daily quota. |
| "API has not been used / is disabled" | The Admin or Data API isn't enabled in the Cloud project (§8.1). |
| Dashboard says "summed daily users" | GA4 couldn't be asked for range-level unique users: the account isn't active, GA4 timed out or hit quota, or it's disabled by env var. The numbers are still right for events and sessions; users count returning visitors once per day. |
| A breakdown table says it "can't be broken down while filtering by …" | The filters and the table come from different dimension families (§7). Remove the filter. |
| `403 Cross-site request blocked` | A state-changing API call came from another site (CSRF guard, §9.1). Use the app's own pages. |
| Numbers differ slightly from the GA4 UI | GA4 thresholding or `(other)` rows (shown as warnings), a different time zone or preset definition (§5d), or data not yet re-synced (the last 3 days are revised). |

### 8.5 Deployment (Render)

- The existing `Dockerfile` is unchanged; GA4 adds no build steps. `.dockerignore` keeps `.env*` out of the image.
- Before deploying, set the §8.1 environment variables in Render.
- After deploying:
  1. Open `/api/health`.
  2. Connect an account on `/settings?tab=analytics`, map a theme, and watch its first sync.
  3. Open `/analytics`.
- **Scaling:** one instance only (the schedulers are in-process; §1). The sync lock prevents duplicate jobs even with more instances, but each instance would still tick.

## 9. Phase 8 review (2026-09-25)

### 9.1 Security

Reviewed: token handling, encryption, the server/client boundary, env vars, OAuth callback validation, API authorization, input validation, logging and error responses.

**OK as built:**
- Tokens are AES-256-GCM encrypted, `select: false`, and never in any response.
- The OAuth state cookie is httpOnly, time-limited, single-use and compared in constant time.
- The analytics.readonly scope and the id token are both verified.
- Every id, date, enum and filter is validated. There's no path for user objects to reach a Mongo query.
- Logs carry only error messages or codes. Google errors map to fixed messages.
- The client bundle contains no server code or secrets (checked on the production build).

**Fixed in Phase 8:**
- **CSRF:** `proxy.ts` rejects cross-site `POST`/`PUT`/`PATCH`/`DELETE` to `/api/*` (Sec-Fetch-Site / Origin host). Non-browser clients are unaffected.
- **Reflected OAuth errors:** the callback's `?error=` now maps to fixed messages instead of echoing attacker-supplied text onto Settings.
- **GCM tag length:** it's enforced at 16 bytes on decrypt.
- **`server-only` guards** on every module that touches tokens, googleapis or the database, so a stray client import fails the build. `slugify` moved to `lib/analytics/slug.ts` to keep the seed script free of them.
- **GA4 quota protection:**
  - no live GA4 call for a filter value with no stored rows (arbitrary `?page=/x1…` values used to each cost live GA4 calls);
  - a process-wide cap of 6 concurrent unique-user lookups;
  - *Sync now* no longer skips a quota wait.
- **Invalid calendar dates** (e.g. `2026-13-01`) returned 500 (`toISOString()` on an Invalid Date threw); they now return 400.

**Open, needs a decision:** when `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` are unset, `proxy.ts` lets everything through, by the app's original design. Anyone with the URL could then read metrics, list connected Google emails, or disconnect accounts. Tokens still can't be read. Make sure both are set on Render. Making production refuse to start without them is a one-line change, but it would lock the live site if they're missing today, so it wasn't made unilaterally.

**Not done (low value here):**
- AAD binding of ciphertexts to their row (needs write access to exploit; would change the token format).
- A per-IP rate limiter (behind Basic Auth, single team).

### 9.2 Database and performance

- **Indexes:** `explain` confirms the metrics queries use `{analyticsThemeId, breakdown, eventName, date}`. The upsert key and the sync lock are covered by the integration tests.
- **Fixed: memory blow-up.** Breakdowns and KPIs used to group rows per day. On a year of page-level data (438k rows, 3 themes) that produced 438k `$group` results, over MongoDB's in-memory limit, and sent them to Node. Non-trend queries now collapse dates to their period inside MongoDB: 2.4k groups in ~1.9 s. Results are identical because those views only sum whole periods. Also added: `allowDiskUse` as a safety net and a 30 s `maxTimeMS`.
- **Response sizes:** a 25-row breakdown page is 70–85 KB of JSON before compression (Next compresses responses by default). Overview requests are about 13 KB.
- **Requests:** two per filter change on the Overview; one per table elsewhere. The theme list loads once per visit to the section. A newer request aborts a stale one.
- **All Themes:** one `$or` query across themes. Unique-user lookups are cached (1 h recent / 30 d settled) and capped as above.

### 9.3 Test results

- **Automated:**
  - 759 tests, all passing, including the MongoDB-backed integration suites (`GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run`).
  - `tsc`, `eslint` and `next build` are clean.
  - The Phase 4 scheduler test, which failed once the real date passed its fixed clock, now pins the system clock too.
- **HTTP probes** against `next start`:
  - invalid and non-existent ids, malformed JSON, bad property ids, `$`-injection attempts, out-of-range paging, bad dates and ranges → clean 400/404;
  - forged OAuth state and cancellation → safe redirects;
  - CSRF → 403.
- **Browser:** every page checked at desktop and 390 px width on synthetic data. Loading, empty and error states verified.
- **Not verified:**
  - the live Google path: OAuth consent, property discovery, the real Data API and real numbers. That needs §8.1 done, then §8.5's post-deploy steps.
  - rate-limit and timeout behaviour against real GA4. The classification and retries are unit-tested against simulated 429/5xx/timeouts.

### 9.4 Known limitations

- Filters from different dimension families (e.g. country + device) can't be combined (§7).
- The journey is aggregate step counts, not user sequences.
- All Themes users are a sum of per-theme users.
- A single server process runs the schedulers.
- Chart axis labels are small on phones.
- Page-level history can grow to hundreds of thousands of rows per theme; `ANALYTICS_HISTORY_START_DATE` caps it.

### 9.5 Recommended next steps

1. Complete §8.1 and run the live regression (§8.5); compare a few figures against the GA4 UI.
2. Confirm Basic Auth is set on Render, then consider making production fail closed without it.
3. Once real data exists, re-measure breakdown latency on Render's MongoDB, and consider a per-period pre-aggregation if page breakdowns are slow.
4. If cross-family filters turn out to matter, add specific paired breakdowns (e.g. country × device) rather than live GA4 queries.
