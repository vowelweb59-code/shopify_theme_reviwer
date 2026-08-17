// Hand-maintained project-phase status — deliberately NOT auto-computed
// from rule/requirement counts, since "is phase 4 done" is a judgment call
// about which acceptance criteria in the phase docs (phase-0 through
// phase-8-*-updated.md) are actually satisfied, not something the
// database can answer by itself. Update this as work on each phase
// progresses — it's the source of truth for the ProjectStatusWidget.
//
// Last reviewed: 2026-08-17 (post phase-7 work: configurable readiness, critical-rule classification, test-coverage tracking, maintenance dashboard + traceability matrix).

export type PhaseStatus = "done" | "in-progress" | "not-started";

export type PhaseEntry = {
  phase: number;
  name: string;
  status: PhaseStatus;
  note: string;
};

export const PROJECT_PHASES: PhaseEntry[] = [
  { phase: 0, name: "Foundation & MongoDB scaffolding", status: "done", note: "Models, DB connection, app shell." },
  { phase: 1, name: "Requirements knowledge base", status: "done", note: "98 requirements, sourced and grounded." },
  { phase: 2, name: "Theme parser", status: "done", note: "Liquid/HTML/CSS/JSON/JS structural extraction." },
  {
    phase: 3,
    name: "Static rules engine",
    status: "done",
    note: "Rule engine wired end-to-end, findings persisted, validated against 2 real themes, automated tests added.",
  },
  {
    phase: 4,
    name: "Advanced static analysis",
    status: "in-progress",
    note: "Theme index, cross-file resolution, template composition, JSON-LD mapping, JS imports, CSS accessibility (aria-hidden-focus added), and performance structure (large inline payload added) all done. Canonical fixture themes added for §19's named scenarios. Validated against 3 real themes (Dawn, Skeleton, Splash). Remaining: no timing/perf instrumentation (§18/21) — left as-is, out of scope for now.",
  },
  {
    phase: 5,
    name: "Reporting & exports",
    status: "done",
    note: "Finding lifecycle (open/resolved/ignored with required reason), submission readiness (READY/NOT_READY/INCOMPLETE), per-category and overall requirement coverage, category dashboards, filter/sort/search, source-context snippets, rule→requirement→source traceability, and CSV/XLSX/JSON/HTML/PDF export all done and verified end-to-end. Google Sheets integration skipped — the phase doc marks it explicitly optional.",
  },
  {
    phase: 6,
    name: "Re-audit / diff",
    status: "done",
    note: "Resolved/still-present/new/changed detection, manual status (open/resolved/ignored) carries forward across re-audits on an exact signature match, reintroduced-issue tracking, severity/category diff breakdowns, a prominent new-blocker regression alert, before/after source snippets, CSV diff export, and a rule-version snapshot per run that attributes a 'new' finding to a new/changed rule vs. a genuine theme change — all verified end to end against a real multi-run theme history.",
  },
  {
    phase: 7,
    name: "Submission-readiness & maintenance",
    status: "in-progress",
    note: "Readiness is now configurable (blocker severities, minimum coverage %) via /settings, rather than hardcoded. Rules are classified critical/important/informational and tracked for test coverage (heuristic: does any test reference the ruleId), both surfaced on a new /maintenance dashboard alongside a full requirement↔rule traceability matrix — already found 3 real critical-but-untested rules on first use. Deliberately not built (confirmed with the user): rule/requirement version changelogs beyond the bare version number, and Shopify-update impact analysis that depends on them — no rule/requirement has ever had a second version, so a full changelog UI would be speculative. Also not built: a 'not_applicable' coverage state, structured partial-rule ✓/✗ limitations UI, and cross-audit quality metrics (findings-per-theme, false-positive rate, avg duration) beyond what the maintenance dashboard already shows.",
  },
  {
    phase: 8,
    name: "Testing, security, deployment",
    status: "in-progress",
    note: "Test suite now 187 tests. ZIP security (path traversal, size/count/archive-bomb limits, guaranteed cleanup) was already fully in place. Added since: the 3 missing MongoDB indexes plus a themeId+status+startedAt compound index, per-stage audit timing (extraction/validation/parsing/index/rules/persistence) stored on every run and shown on the report page, a GET /api/health endpoint, object-id and filter-enum validation across every API route (previously an invalid id crashed with a raw 500), and an application/rule-engine/requirements version snapshot per run alongside the existing parser/rule versions. Not yet done, deliberately deferred pending a future scoping decision: frontend pagination/virtualization, structured production logging, MongoDB auth/backup/release-checklist documentation (ops concerns for an internal single-user tool), the optional API-auth boundary, and a final consolidated phase-8 §29 acceptance run (individual pieces of it have been verified live throughout this session, but not as one end-to-end pass).",
  },
];

const STATUS_WEIGHT: Record<PhaseStatus, number> = { done: 1, "in-progress": 0.5, "not-started": 0 };

/** Simple, approximate — done/in-progress/not-started weighted evenly across phases. Meant to be indicative, not a precise metric. */
export function overallCompletionPercent(): number {
  const total = PROJECT_PHASES.reduce((sum, p) => sum + STATUS_WEIGHT[p.status], 0);
  return Math.round((total / PROJECT_PHASES.length) * 100);
}
