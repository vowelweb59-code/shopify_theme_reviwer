# Phase 5 — Report Writer (Google Sheets)

**Depends on:** Phase 3 and Phase 4 (needs real findings to export). Phase 0's `audit_runs`/`findings` tables must be populated.
**Goal:** Every completed audit run produces a Google Sheet you can actually work from — sorted, color-coded by severity, and linked back from the `/reports` page.

## Scope

### Auth setup
- Use a Google Cloud service account (not OAuth) — simplest path for a single-user internal tool. Create the service account, download the JSON key, store credentials as env vars (never commit the key file).
- Share the target spreadsheet(s) with the service account's email so it has write access — do this once during setup.

### Spreadsheet structure
- One persistent spreadsheet: "Theme Audits" — don't create a new spreadsheet per run, create a new **tab** per run instead. This makes cross-run comparison for the same theme trivial later (Phase 6's trend view depends on this).
- Tab naming: `{theme name} — {date} — {run id short}`.
- Within each tab, three sections (can be three actual sub-tabs if cleaner, but a single tab with clear section headers is fine for v1):
  - **Summary** — counts by severity, counts by category, and a pass/fail line against Theme Store compliance (any `blocker` in the `Theme Store Compliance` category = fail).
  - **Findings** — the full table: file, line, category, severity, layer, finding, recommendation, source reference. Sort by severity descending by default.
  - Leave room for a **Trend** section, but don't build the actual trend logic yet — that's Phase 6.

### Formatting
- Conditional formatting on the severity column: `blocker` red, `high` orange, `medium` yellow, `low` neutral/grey. Use the Sheets API's `addConditionalFormatRule` request, not manual cell-by-cell coloring.
- Freeze the header row.
- Auto-resize columns after writing (Sheets API supports this) so it's readable without manual adjustment.

### Flow
1. Audit run completes (all Phase 3 + Phase 4 findings written to `findings` table).
2. Report writer reads all findings for that `audit_run_id`, builds the summary counts, writes both sections to a new tab.
3. Store the resulting `sheet_url` (deep link to that specific tab, not just the spreadsheet root) back on the `audit_runs` row.
4. `/reports` page lists past runs with a direct link to each tab.

## Acceptance criteria

- Run an audit end to end (Phases 2→3→4→5 chained) and confirm a real Google Sheet tab appears with correctly formatted, correctly sorted, correctly colored data.
- The deep link stored actually opens to the right tab, not just the spreadsheet.
- Re-running an audit on the same theme creates a new tab rather than overwriting the previous one — history matters here.

## Explicitly out of scope

No trend/diff logic across runs yet (Phase 6), no severity gating logic beyond the simple pass/fail summary line described above.
