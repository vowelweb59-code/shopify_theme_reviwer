// Submission readiness (phase-5 §3) — deliberately computed on read, never
// persisted on the AuditRun, since both inputs (a finding's manual status,
// and how much of the requirement set now has an implemented rule) change
// independently of the audit run itself. Persisting a stale READY/NOT_READY
// would silently drift from reality as soon as either changed.

export type ReadinessStatus = "READY" | "NOT_READY" | "INCOMPLETE";

export type ReadinessFinding = {
  severity: string;
  status?: string | null;
};

export type ReadinessResult = {
  status: ReadinessStatus;
  reasons: string[];
};

// Below this, a clean audit doesn't mean much — too many requirements have
// no automated check behind them yet. Approximate and adjustable, not an
// exact science; documented here rather than left as a bare magic number.
export const READINESS_COVERAGE_THRESHOLD_PERCENT = 70;

function isUnresolved(finding: ReadinessFinding): boolean {
  return finding.status !== "resolved" && finding.status !== "ignored";
}

/**
 * NOT_READY takes precedence over INCOMPLETE — an unresolved blocker is a
 * definite problem regardless of how much rule coverage exists. Never
 * reports READY when coverage is too thin for the claim to mean anything,
 * per phase-5's explicit requirement.
 */
export function computeReadiness(findings: ReadinessFinding[], coveragePercentage: number): ReadinessResult {
  const openBlockers = findings.filter((f) => f.severity === "blocker" && isUnresolved(f));
  if (openBlockers.length > 0) {
    return {
      status: "NOT_READY",
      reasons: [`${openBlockers.length} unresolved blocker finding${openBlockers.length > 1 ? "s" : ""}.`],
    };
  }

  if (coveragePercentage < READINESS_COVERAGE_THRESHOLD_PERCENT) {
    return {
      status: "INCOMPLETE",
      reasons: [
        `Automated rule coverage is ${coveragePercentage.toFixed(1)}%, below the ${READINESS_COVERAGE_THRESHOLD_PERCENT}% this tool treats as enough for a meaningful readiness claim.`,
      ],
    };
  }

  return { status: "READY", reasons: [] };
}
