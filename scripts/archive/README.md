# Archived one-off scripts

These scripts were each run once (most on the live database, 2026-11-12 to 2026-11-21) to fix or fill specific data, and hard-code the
projects, names or amounts they were written for. They are kept so the record of what was done stays readable (each one's header says
why it was written and what it changed; `DECISIONS.md` names the owner decision behind it). They are **not** meant to be run again as they
are: read the script first, the data they expect may no longer look the way it did.

Reusable tools stay in `scripts/` (seeds, backups, `add-service-project`, `set-service-project`, `service-remove-*`,
`service-reread-stored`, `import-revenue-sheet`, and so on).

Run an archived script from the project root like any other, e.g.
`npx tsx --env-file=.env.production.local scripts/archive/<name>.ts` (dry run unless it says `--apply`).
