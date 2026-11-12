# Themes section: automation scope

Written 2026-11-12 after reading `/themes`, `/themes/[id]`, their API routes, the audit pipeline and the schedulers.
Goal: the page should fill itself and tell the owner what to do next, instead of needing someone to feed it.

## 1. Why the page is little used

In the live screenshot 21 of 30 themes show "—" everywhere (no version, no health, no scores). The page ranks themes by
update urgency, but that ranking only works for a theme that has had **three separate manual chores**, each on a
different screen:

1. Click **Check Theme Store** (Last Update, mismatch flag, features, reviews).
2. **Upload a ZIP** (Current Version; nothing else works without it).
3. Click **Run Audit** (Health, Passed/Failed, Features, Future Updates, Performance, Recommendations).

Nothing runs these on a schedule, nothing links them to the Projects section, and nobody is told when a theme needs them.

## 2. Every process today

| # | Process | Trigger | Needs | Automated? |
|---|---|---|---|---|
| 1 | Add theme (`AddThemeModal`, `POST /api/themes`) | Button | Name **and a ZIP** | No. `npm run theme:add` creates a theme without a ZIP, but is a CLI run by the owner |
| 2 | Theme Store listing check (`POST /api/themes/[id]/theme-store-features`): version, release date, features, presets, reviews | Per-theme button, or **Check All Theme Stores** | Theme name (slug derived from it) | No. "Check All" is a loop in the browser tab, one theme at a time; closing the tab stops it. Only the Demo Store tracker re-checks listings automatically, for its own records |
| 3 | Preset demo URLs (`Autofetch from Theme Store`, then edit, then Save) | Button, 3 clicks | Check Theme Store | No |
| 4 | Upload version (`POST /api/themes/[id]/versions`): reads the version from the ZIP, stores the ZIP | Button + file pick | A ZIP in hand | No. `ThemeSource` in `lib/themes/themeSource.ts` is the planned seam for Git, but only `local_upload` exists |
| 5 | Run Audit (`.../versions/[v]/audit`): rules, enhancement detection, live checks, PageSpeed | Button | Uploaded ZIP + saved presets | No. Takes minutes; the page polls |
| 6 | Read results, Recommendations, "worth a second look" feature conflicts | Human | A finished audit | No |
| 7 | Download report / export to Google Sheet | Dropdown | A finished audit | No |
| 8 | Ranking on the Theme Store | Scheduler (daily) | | **Yes** (`rankingScheduler.ts`) |
| 9 | Theme Store catalog of all themes (version, release date, features, presets, reviews, price) | Scheduler (daily) | | **Yes** (`themeStore/scheduler.ts`), but stored in `ThemeStoreTheme`, a different collection that the Themes page does not read |
| 10 | Deciding what to update next | Human reads the ranked table | All of the above | No. Nothing creates a project or task from it |

Biggest finding: **process 2 is already being done every day by process 9.** The catalog crawl stores `latestVersion`,
`latestVersionReleasedAt`, `features`, `presets`, `reviewCount` and `positivePercent` for every store theme, including
ours. The Themes page keeps a second, hand-refreshed copy of the same facts on `Theme`.

## 3. Proposed automation, in build order

### Phase 1: make the page fill itself with no human input (small, no new inputs needed)

| Item | What changes |
|---|---|
| 1a. Sync `Theme.themeStore*` from `ThemeStoreTheme` | After each catalog crawl, for each `Theme` whose derived slug exists in the catalog, copy version, release date, features, presets (keeping rank fields), reviews. "Last Update", the mismatch flag and the priority score then work for all 30 themes with zero clicks. Keep the per-theme button as a force refresh |
| 1b. Server-side "Check All" | Replace the browser loop with one job (reuse `repeatingJob` + the Mongo lease) that survives closing the tab, with progress on the page. Only needed for themes the catalog does not cover (a theme not yet public) |
| 1c. Presets without clicks | When the listing check finds presets and the theme has no saved presets, fill `demoStorePresets` from `fetchPresetDemoStoreUrls`. Never overwrite presets a person edited (add `presetsEditedAt`) |
| 1d. Theme with no ZIP | Let `POST /api/themes` and the modal create a theme from just a name (the Theme Store check fills the rest), the way `theme:add` already does |
| 1e. Status chip per row | A "Next step" column: *Needs Theme Store check* / *Needs ZIP* / *Needs audit* / *Behind Theme Store (live X, ours Y)* / *Stale N days* / *OK*. Row click goes straight to the right action. This alone turns the 21 empty rows into a to-do list |

### Phase 2: audits without a ZIP, and scheduled audits

| Item | What changes |
|---|---|
| 2a. **Live-only audit** | Live checks and PageSpeed only need the demo-store preset URLs, not the ZIP. Add a mode in `executeAuditRun` that skips the rule engine and fills only Performance/live results, so Desktop/Mobile Performance (20% of the priority score) exist for every theme that has presets. Needs a check that the scoreboard handles a run with no rule findings (assumption, not verified) |
| 2b. Audit triggers | Run an audit automatically when (a) a new version is stored, (b) the Theme Store version changes, (c) the last audit is older than N days (suggest 30) for Core Web Vitals drift. Queue through the existing `auditSlots.ts` so only a few run at once, one theme's audit at a time per theme |
| 2c. Failure handling | A failed or interrupted audit retries once, then shows a reason in the row chip instead of silently staying empty |

### Phase 3: get the ZIP without a person (needs an owner decision, see section 4)

The ZIP is the only input no amount of scraping can replace: themes.shopify.com does not publish the source. Options:

| Source | How it works | Notes |
|---|---|---|
| **Git repository per theme** (recommended) | Store a repo URL + branch on `Theme`; a `GitSource` implementing the existing `ThemeSource` seam exports the latest tag/commit to a buffer; a new tag with a higher `theme_version` becomes a version, then 2b audits it | The code already anticipates this (spec §8). Needs read-only deploy keys or a token per repo |
| Google Drive folder per theme | A watched folder; a new ZIP becomes a version | The Google connection already exists; ZIPs must still be exported by hand |
| Shopify CLI / Admin API pull | Pull the theme from the dev store the team uploads to | Only if the team always uploads to a store we can reach |

### Phase 4: close the loop with Projects and reporting

| Item | What changes |
|---|---|
| 4a. Link versions to projects | When a project reaches `theme_uploaded` or `live` (Chat reports already set `kind: update/theme/preset`), match the theme and prompt or auto-run Check Theme Store + audit of the newest ZIP. Show the project next to the version |
| 4b. Suggest the next project | The top-priority theme with no open Theme Update project gets a one-click "Create update project" prefilled with its top 5 Recommendations as the description |
| 4c. Weekly digest | One Chat/email message: themes behind the Theme Store, themes over 90 days, biggest score drops since the last audit, audits that failed. Reuses the Google Chat connection (theme side) |
| 4d. Auto Google Sheet | After each audit, update the theme's persistent sheet (`googleSpreadsheetId` already exists) instead of a manual export |
| 4e. History | Keep each theme's score per audit so the table can show a trend arrow (the audit runs already exist; this is a read, not new storage) |

## 4. Decisions needed from the owner

1. **Where does the ZIP come from?** Git per theme, a Drive folder, or keep uploading by hand but only when the chip says so. This decides whether Phase 3 is worth building.
2. Is a **30-day re-audit** right, or should audits only run on a new version?
3. Are **live-only audits** acceptable as the Performance score for a theme with no ZIP, labelled "live only"?
4. For 4b, should a project be **auto-created** or only suggested?
5. Which themes are actually live on the Theme Store? Themes not listed there (Apollo, Aroma... in the screenshot) cannot sync until they are, so they should show "Not published" rather than "Needs check".

## 5. Suggested order and size

| Order | Phase | Size | Result |
|---|---|---|---|
| 1 | 1a + 1e | Small | Every theme gets Last Update and a Next step with no clicks |
| 2 | 1b-1d | Small | No browser-tab loop; add a theme by name only |
| 3 | 2a + 2b | Medium | Performance and health fill themselves |
| 4 | 4b + 4c | Small to medium | The page produces actions, not just a table |
| 5 | Phase 3 | Medium to large | Only after decision 1 |
| 6 | 4a, 4d, 4e | Medium | Polish |

## 6. Constraints to keep

- Public-site reads use `lib/net/fetchPublic.ts` (retry on 429); do not add a second fetcher.
- Long jobs use `lib/jobs/lease.ts` so a second server instance does not run the same job.
- Schedulers start in `instrumentation.ts`; a free Render instance only runs while awake.
- Editing `models/*.ts` needs a dev-server restart.
- Destructive theme actions are recorded in `admin_audit_log`; auto-created rows should not be deletable by a job.
