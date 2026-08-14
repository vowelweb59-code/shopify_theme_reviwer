// Hand-maintained project-phase status — deliberately NOT auto-computed
// from rule/requirement counts, since "is phase 4 done" is a judgment call
// about which acceptance criteria in the phase docs (phase-0 through
// phase-8-*-updated.md) are actually satisfied, not something the
// database can answer by itself. Update this as work on each phase
// progresses — it's the source of truth for the ProjectStatusWidget.
//
// Last reviewed: 2026-08-14 (post CSV/PDF export + re-audit diff).

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
    note: "Theme index, cross-file resolution, template composition, JSON-LD mapping, JS imports all done. Validated against 3 real themes (Dawn, Skeleton, Splash) — found and fixed real parser/rule bugs each time. Remaining: broader CSS/perf coverage, more real-theme validation.",
  },
  {
    phase: 5,
    name: "Reporting & exports",
    status: "in-progress",
    note: "Report UI, live demo-store checking, and CSV/PDF export done. XLSX/JSON/HTML export, finding lifecycle (open/resolved/ignored), category dashboards, and search are not built.",
  },
  {
    phase: 6,
    name: "Re-audit / diff",
    status: "in-progress",
    note: "Core comparison works: resolved/still-present/new/changed detection via stable ruleId+category+filePath+message signatures, verified against a real fixed-then-regressed theme. Manual finding status, ignored-finding persistence, reintroduced-issue tracking, and diff exports are not built.",
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
