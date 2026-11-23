# Build prompt: standalone Service Team app for all departments

Paste this whole file as the first message to the coding agent in a NEW, empty repository. It is distilled from the working
**Digital Marketing** Service section of the "Shopify Theme Auditor" app (its `DECISIONS.md` is the source of every rule below).
Goal: the same system, but standalone, and for **three departments from day one: Digital Marketing, Front End, Shopify Apps**.

Keep a `DECISIONS.md` in the new repo from the first commit. Update it in the same change whenever a decision, rule, file location
or open item changes, and decide the next step from it instead of re-reading the project.

---

## 1. What this app is

An internal tool for the owner (and a few managers) to monitor the **service team**: which Upwork client projects exist, who works on
them, how many hours were reported against each, what that is worth in money, and whether each project is healthy (active, on hold,
closed). Hours are **reported hours from a Google Chat space (TIMER STATUS), not Upwork-verified billing**.

Not in scope: anything about themes, Shopify Theme Store, GA4, attendance, sales sheets for themes. Only the Service side.

## 2. Owner decisions that shape everything (do not re-ask)

| Decision | Consequence |
|---|---|
| One shared login, everything visible | No roles, no per-project permissions, no money hiding. Rates, fixed prices and salaries are shown and editable to anyone signed in. |
| **Departments are first-class** (Digital Marketing, Front End, Shopify Apps) | Every project, member, rule and number belongs to a department. A department switcher at the top; every page and every rule is scoped to the chosen department. Nothing is hard-coded to Digital Marketing. |
| Only a department's own people define "our" hours and revenue | A project's hours can come from anyone, but the **department's** hours are those reported by its own members. The sales sheet's money is per department, so it is compared with that department's hours only. |
| Everything that writes to the production database is run by the owner, one command at a time | One-off changes are scripts: **dry run by default, `--apply` writes**, every apply writes an audit record. The agent never runs `--apply` against production unless the owner explicitly asks in that message. |
| Never write money or pay figures into the repo, tests, fixtures or DECISIONS.md | Rates, prices, salaries and sheet totals live only in the database (and the owner's files outside the repo). Tests use made-up numbers. |
| Simple, colourful BI-style dashboards, not cluttered | One light filter row, a few headline numbers, ONE table. Colour on numbers and bars, no status-badge column, no boxed filter bars. |
| No manual import buttons | Hours sync by themselves; the sales sheet is imported by the owner from the terminal. |

## 3. Stack (use the same, it is proven)

- Next.js (App Router, server components render the pages; server code reads the database directly, thin `app/api/**` routes only for writes and the browser).
- TypeScript, Mongoose on MongoDB (Atlas live, Docker Mongo local), Vitest for tests, tsx for scripts (`tsx --env-file=.env.production.local scripts/x.ts`).
- Deployed as a Docker image (standalone output) on Render; repeating jobs start from `instrumentation.ts` and only run while the instance is awake.
- Auth: one shared session cookie (`BASIC_AUTH_USER/PASSWORD`, `SESSION_SECRET` of 32+ characters), login throttle. Production refuses every page without them.
- Google Chat read through one Google OAuth client (readonly Chat scopes); the connected account must be a member of the spaces read.
- Windows dev machine gotchas: start `npm run dev` from the owner's own terminal; Git Bash rewrites `/flags` into paths.

## 4. Data model (MongoDB collections, `_id` = UUID string, prefix `svc_`)

| Collection | Holds |
|---|---|
| `departments` | name, slug, `chatSpaceId` (TIMER STATUS space or shared space), `newProjectSpaceId`, `salesSheetKey`. |
| `members` | A person of the company: name, aliases, department, `kind` (team member / BA / BD / manager), `active`, `leftOn`. **This replaces the hard-coded `DM_MEMBERS`, `BA_MEMBERS`, `BD_MEMBERS` lists** (they become rows, editable on a Team page). A person may belong to more than one department. |
| `clients` | Client name, aliases (same-named clients are merged by normalised name), `splitAcrossProjects` flag. |
| `upwork_accounts`, `upwork_profiles` | The Upwork agency accounts and the freelancer profiles (name, aliases) used to place hours. |
| `projects` | name ("Client – Profile"), `departmentId`, `clientId`, `upworkProfileId`, `status`, `startDate`, `history[]` (from, to, reason, at), embedded `contract` (type HOURLY/FIXED, `hourlyRateCents`, `fixedPriceCents`, `weeklyLimitMinutes`, `weeklyLimitHistory[]`), `people[]` (role BA/BD/executive/other, name, senderId), `assignments[]`, `reviewRating`. **One contract per project.** |
| `chat_senders` | Everyone who posts in Chat: externalId, displayName, linked member. |
| `chat_messages` | Raw Chat messages (kept so a parser fix can re-read them without re-fetching). |
| `time_entries` | One row per reported block: `projectId` OR `allocations[{projectId, minutes}]` (split entries have no projectId), `clientId`, `minutes`, `entryDate` (IST day), `senderExternalId`, `state` (counted / AUTO_IGNORED / APPROVED / REJECTED), notes. |
| `revenue_taken` | month, clientName, section, profile, BDE, `amountCents`, `departmentId` (from the sales sheet). |
| `audit_log` | Hash-chained (seq, action, detail, at, prevHash, hash). Every write, from the UI or a script, appends one. |
| `job_leases` | Mongo lease so one import per month/department runs at a time across instances. |

Rules for these:
- Every per-project total goes through ONE attribution function (`projectOf` + `expandAllocations`): a split entry counts its allocations, a plain entry counts to its project, an entry with no project but a client that has exactly one project goes there. Never sum `minutes` by project any other way.
- Dates are **IST** days; weeks start **Monday**; Sunday is off.
- Cache heavy reads in a small in-process TTL memo (`memo(key, ms, fn)` with shared in-flight loads, a failed load is not kept, `forgetMemo("prefix:")`). Every audited write calls `forgetMemo` so changes show at once.

## 5. Hours pipeline (Google Chat -> time entries)

- Source: the TIMER STATUS Chat space (one per department, or one space with a department per sender). Import is **per IST month, idempotent**; an edited message replaces its own entries; entries a person approved or rejected survive re-imports. Re-read the **last 3 days** on every sync so edits are caught.
- Auto sync: current month **every 15 minutes**, last month once per IST day, skipped until Chat is connected. Start 60 s after boot (stagger jobs so the first page requests are not competing with every sync). Use the Mongo lease so two syncs never overlap. If Google returns `invalid_grant`, mark the connection revoked and stop until reconnect.
- Parsing: Timer = OFF minus ON for the same sender, client and profile; manual reports are real hours; with both on one day the **larger counts**. Over 8h30 of timer, stranded ON/OFF, zero-hour entries and OFF without ON are set aside (`AUTO_IGNORED`). A report's "ON timer" figure with no timer hours behind it counts. Week cutoff Monday 17:30 IST. Review never blocks counting.
- Placement for a client with several projects: first the keyword written, then the Upwork profile, then the only project listing the poster, then (if the client is set to split) equal shares over projects active in the last 14 days. A person's placement is never moved.
- **Outsider rule (per department):** only the department's own senders define its hours, but a person outside the department who reports on one of the department's projects must still be counted on that project. Keep an outsider's entry when they are on ANY of the client's department projects' people list; write the project on the entry only when it is exactly one, else use the normal placement rules. Entries of outsiders tied to no department project are dropped at import, not stored. On every project page and table, a `*` stands before the name of anyone outside the department.
- A project page has a switch **Count hours of: Everyone | My department only** (`?hours=team`); default Everyone. It covers the week figures, amount, "By person" and "Who worked how much".

## 6. Project status rules

Statuses: Not started, Active, Blocked, Waiting for client (all shown as **Active**), On hold, Completed, Cancelled, Archived (shown as **Closed**). Legal transitions are enforced in one pure module.

Automatic rules, run after every import (all IST, all recorded in the project's `history` with a reason):
1. **No hours by anyone for 30 working days** (Sundays skipped, window includes today) puts an Active project On hold ("Automatic: no hours for 30 working days").
2. **Department-idle rule:** an Active project that has a department member on it and **no report by a department member for 60 calendar days** goes On hold ("Automatic: no <Department> team report for 60 days"). Other people's hours do not count here. A project that began inside the window is not touched.
3. New hours lift only an automatic hold (the two above), never a hold set by hand.
4. **Hold until my team reports** (a script, `service-hold-project.ts "<name>" [--apply]`): puts an Active project On hold with reason "Hold until a <Department> team report"; the rules resume it on the first department-member report dated **after** the day it was held. A hold set by hand in the UI does not resume by itself.
5. The reason text on a hold must be exact constants shared by the code that sets it and the code that recognises it (`isAutoHold`).

New and ended projects are announced in a second Chat space ("New Project Update", e.g. `Accepted the project of <client> - <profile> - $<rate> hr - <BD> | <BA> | <start date>` and `Contract ended of <client> with <n>-star ratings on <profile>`). Sync them after each hours sync: accepted creates the client if new and an Active hourly project (rate, profile, BD, BA, start date); ended completes the client's ONE open project with the rating. Guards: a client that already has an open project gets no second one, and a post is acted on only when its client already exists or a **department** member has reported hours for that name (the space announces every service project of the company, including other departments'). BA and BD named in a post are accepted only if they are in the department's member lists.

## 7. Contract, limits and money rules

- **Hourly:** hours x hourly rate. **Weekly limit** (hours per week, the "quota"/scope). Changing it asks **"correcting the original value" or "the client changed the scope"**; a scope change needs a **Monday** start date (the owner picks which Monday, the server refuses other days) and is stored as a dated step in `weeklyLimitHistory` (the old value becomes the first step). A week uses the step in force on its last day; a month pro-rates the limit over its weeks. A correction edits the step in force today.
- **Fixed price:** workable hours = fixed price / **$15** (the standard rate), a total over the project's life, not weekly. Hours cannot be blocked (they come from Chat), so going over is **flagged (red), not prevented**.
- **Fixed + hourly rate entered = billed by the hours:** no workable-hours cap and no price scope; revenue = hours x that rate. A fixed project with no rate uses the $15 cap.
- Revenue and scope in dollars on the overview: hourly = hours x rate against weekly limit x rate; fixed = hours used x $15 against the fixed price. Closed projects show "Taken from client" (hourly: hours x rate; fixed: the fixed price, or hours x rate for a fixed project with no price but a rate).
- An hourly contract with no rate and no weekly limit is **"Not set"** (shown only under All). Contracts are edited by anyone signed in on the project's page.

## 8. Pages

Department switcher + tabs: **Overview**, **Revenue**, **Projects (detail pages)**, **Team**, **Settings/Chat connection** (hidden from the tab strip but reachable). Pages read the database directly; render every changed server page against live data before pushing (see 11).

**Overview (BI style):** one light filter row: status tabs with colour dot and count (Active default, On hold, Closed, All) on the left; on the right a small Timer / Fixed / All switch and one "My department only" toggle. Four headline numbers with coloured left edge: Active projects (on-hold count in its note), Hours (this period) against combined quota with %, Revenue (this period), Projects over limit; Closed shows Closed projects, Average closing review, Taken from clients. ONE table: Project (profile under the name), BA / BD (two lines), Type (Hourly/Fixed pill, rate or price under it), Hours (hours of quota with a bar: green under 80%, amber from 80%, red over), Revenue (bar, scope under it). No Status column. Closed adds Review and Taken. **Period bar:** Week | Month, previous/next arrows and a "Jump to a date" box, plain GET params (`?by=month&on=YYYY-MM-DD`, no JavaScript); hours of a past period count entries by entry date; fixed rows show their ALL-TIME total plus a line for the period; hidden on Closed (all-time). BA and BD dropdowns suggest only the department's BA/BD members.

**Project page:** contract editor (type, rate, price, weekly limit with the why-changing radios and Monday date, workable-hours hint), people (BA/BD), "Fixed budget in hours" card, "Billed by the hours" card, week hours with team-only switch, By person, Who worked how much (outsiders marked `*`), status control with legal transitions, history.

**Revenue tab:** compares **money actually taken** (sales sheet) with **what the hours were worth** (department hours x the project's current hourly rate; fixed with no rate = $15/h; no rate = not priced), same calendar month as the sheet tab. One question at a time: range switch (last 12 months / this year / all), status tabs Active / On hold / Closed / Not in the app / All (with counts), three plain numbers (We took, Hours were worth, We took less/more by), ONE client table (We took, Hours were worth, Difference, Result chip: Took less / About right / Took more / No rate set; 25 worst first, rest folded), month-by-month folded away. A client's status = Active if any of its projects runs, else On hold, else Closed; sheet clients with no project are "Not in the app". Client matching (`matchClient`, pure, tested): exact, alias, "William P" = "William Poon" (same first name, last word an initial), "M Rabi" = "Mohammed Rabi", "Saleem Joya" = "Sal Joya" (same last name, first names start with each other, 3+ letters); ambiguous names are skipped; approximate matches are listed for the owner to read once. **Hours counted are the department's own members' hours only.** URL params `?range=12m|ytd|all&status=...`.

## 9. Scripts (all dry run by default, the owner runs `--apply`, every apply writes an audit record)

- `import-revenue-sheet.ts "<xlsx>" --department <slug> [--months=YYYY-MM] [--apply]`: reads the sheet's per-month tabs (column TOTAL AMT; skip rows matching `/^\s*(grand\s+|sub\s*)?total(\s|$)/i`); `--months` replaces only those months, otherwise the department's whole set. The owner adds each new month from the terminal; **there is no upload button**. Never put sheet amounts in the repo.
- `add-service-project.ts "<Client>" --profile <p> [--ba] [--bd] [--rate] [--limit-hours] --department <slug>`: creates a client/project by hand and re-matches waiting Review entries.
- `set-service-project.ts "<Project>" [--fixed USD] [--rate] [--limit-hours] [--ba] [--bd] [--status]`: sets contract and people by hand.
- `service-hold-project.ts "<Project>"`: hold until the department reports (section 6).
- `service-remove-project.ts "<Project>" [--include-department-members]`: removes a project (and its client if it has no other project, its entries, and the Chat messages only they came from); refuses when a department member has hours on it.
- `service-clean.ts --department <slug> --since <date>`: re-plans stored messages with the outsider rule and removes entries of people outside the department that are not tied to a department project.
- A one-time migration script is needed per department if existing data lives elsewhere (the original app migrated from Postgres by `--digital-marketing`: only projects one of the department's people is on, their clients, hours, Chat messages).

## 10. Sections of the original DECISIONS.md to carry over as-is into the new DECISIONS.md

Keep these headings, rewritten for the new app: "Restart here" (what is done / open / waiting on the owner), "Environments and deployment" (local vs live table; Render may not auto-deploy so check the Deploys page after pushing), "Where things are" (files per area), "Data model choices", "Business rules", "What is shown", "Open items". Do not carry theme-team, App Store, attendance, GA4 or analytics sections.

## 11. Engineering practices (mandatory)

1. Pure rules (parsers, planner, attribution inputs, limit history, fixed budget, name matching, hold rules) live in pure modules with Vitest tests beside them; database code is thin.
2. Before pushing a change to a server page, **render it against live data read-only**: a temporary tsx script with a stub `node_modules/server-only` and `react-dom/server` `renderToString`, then delete the stub and script. A const used before its definition crashed a page once and passed typecheck and lint.
3. Run typecheck, lint and tests before every commit; commit and push after each requested change; update DECISIONS.md in the same commit.
4. Measure before optimising; cache only what the numbers point at.
5. Never run `npm run dev` from the agent's shell; the owner starts it from a normal terminal.
6. Editing a Mongoose model needs a dev-server restart or new fields silently no-op.

## 12. Build order

1. Repo, auth, Mongo connection, departments + members collections and Team page (member lists per department: **the owner provides them**).
2. Models, attribution, week/IST helpers, contract rules (limit history, fixed budget) with tests.
3. Google Chat connection, hours import pipeline with the outsider rule, scheduler, lease.
4. Project pages and the status rules (auto hold, department-idle hold, hold-until-report script).
5. Overview dashboard with the period bar.
6. New-project post sync.
7. Revenue tab and the sheet import script.
8. Migration of existing Digital Marketing data, then Front End and Shopify Apps.
9. Scripts, audit log, caching pass, DECISIONS.md complete.

## 13. What the owner must supply before step 1 (ask once, then proceed)

- Member lists for **Front End** and **Shopify Apps** (name, aliases/spelling in Chat, BA/BD/executive role, who left); Digital Marketing's list exists in the old app.
- Each department's TIMER STATUS space (or whether all departments post in one space), and its "New Project Update" space.
- Whether Front End and Shopify Apps have their own sales sheet (format of `TOTAL AMT`, month tabs) and whether $15/h is also their standard rate for fixed projects.
- Whether the same rules (30 working days / 60 days idle, 8h30 timer cap, Monday cutoff) apply unchanged to the other two departments; assume yes unless told otherwise.
- Whether a client can have projects in more than one department (assume yes: the same client record, projects per department).

## 14. Known open items from the original (decide, do not silently assume)

- Rates have no history, so older months use today's rate. Status has no history either.
- Some entries dated far in the future (typing errors) are ignored by the comparison.
- The two-weekly payment of "billed by the hours" projects is not modelled.
- Skipped new-project posts are returned but shown nowhere yet.
- A sleeping Render instance syncs nothing until woken.
- Secrets pasted in chat must be rotated; keep all credentials in the host's environment settings, never in the repo.
