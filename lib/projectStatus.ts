// Hand-maintained project-phase status — deliberately NOT auto-computed
// from rule/requirement counts, since "is phase 4 done" is a judgment call
// about which acceptance criteria in the phase docs (phase-0 through
// phase-8-*-updated.md) are actually satisfied, not something the
// database can answer by itself. Update this as work on each phase
// progresses — it's the source of truth for the ProjectStatusWidget.
//
// Last reviewed: 2026-08-17 (post phase-6 work: status carry-forward, reintroduced tracking, severity/category diff summaries, before/after snippets, diff export).

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
    status: "in-progress",
    note: "Resolved/still-present/new/changed detection, manual status (open/resolved/ignored) now carries forward across re-audits on an exact signature match, reintroduced-issue tracking, severity/category diff breakdowns, a prominent new-blocker regression alert, before/after source snippets, and CSV diff export — all verified against a real multi-run theme history (first_seen → resolved → reintroduced → persistent, confirmed end to end). Remaining: rule/parser version tracking (distinguishing 'new because of a rule change' from 'new because of a real regression') isn't built — no rule has ever had a second version yet, so this was deferred rather than built prematurely against an untested need.",
  },
  { phase: 7, name: "Submission-readiness & maintenance", status: "not-started", note: "Go/no-go dashboard, ongoing tracking." },
  {
    phase: 8,
    name: "Testing, security, deployment",
    status: "in-progress",
    note: "Automated test suite (67 tests) added. Security review and deployment not addressed.",
  },
];

const STATUS_WEIGHT: Record<PhaseStatus, number> = { done: 1, "in-progress": 0.5, "not-started": 0 };

/** Simple, approximate — done/in-progress/not-started weighted evenly across phases. Meant to be indicative, not a precise metric. */
export function overallCompletionPercent(): number {
  const total = PROJECT_PHASES.reduce((sum, p) => sum + STATUS_WEIGHT[p.status], 0);
  return Math.round((total / PROJECT_PHASES.length) * 100);
}
