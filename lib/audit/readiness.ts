// Submission readiness (phase-5 §3, made configurable in phase-7 §2) —
// deliberately computed on read, never persisted on the AuditRun, since
// both inputs (a finding's manual status, and how much of the requirement
// set now has an implemented rule) change independently of the audit run
// itself. Persisting a stale READY/NOT_READY would silently drift from
// reality as soon as either changed.

export type ReadinessStatus = "READY" | "NOT_READY" | "INCOMPLETE";

export type ReadinessFinding = {
  severity: string;
  status?: string | null;
};

export type ReadinessResult = {
  status: ReadinessStatus;
  reasons: string[];
};

export type ReadinessConfig = {
  // Which severities count as submission-blocking (phase-7 §5) — do not
  // automatically treat every "high" finding as a blocker unless a
  // maintainer has actually configured it that way.
  blockerSeverities: string[];
  // Below this, a clean audit doesn't mean much — too many requirements
  // have no automated check behind them yet.
  minimumCoveragePercent: number;
};

// Matches this project's behavior before phase-7 made it configurable —
// changing these defaults changes what every audit's readiness verdict
// means, so treat them as a real decision, not a tuning knob to fiddle
// with casually.
export const DEFAULT_READINESS_CONFIG: ReadinessConfig = {
  blockerSeverities: ["blocker"],
  minimumCoveragePercent: 70,
};

function isUnresolved(finding: ReadinessFinding): boolean {
  return finding.status !== "resolved" && finding.status !== "ignored";
}

/**
 * NOT_READY takes precedence over INCOMPLETE — an unresolved blocker is a
 * definite problem regardless of how much rule coverage exists. Never
 * reports READY when coverage is too thin for the claim to mean anything,
 * per phase-5's explicit requirement.
 */
export function computeReadiness(
  findings: ReadinessFinding[],
  coveragePercentage: number,
  config: ReadinessConfig = DEFAULT_READINESS_CONFIG
): ReadinessResult {
  const blockerSeverities = new Set(config.blockerSeverities);
  const openBlockers = findings.filter((f) => blockerSeverities.has(f.severity) && isUnresolved(f));
  if (openBlockers.length > 0) {
    return {
      status: "NOT_READY",
      reasons: [
        `${openBlockers.length} unresolved blocker finding${openBlockers.length > 1 ? "s" : ""} (configured blocker severities: ${config.blockerSeverities.join(", ")}).`,
      ],
    };
  }

  if (coveragePercentage < config.minimumCoveragePercent) {
    return {
      status: "INCOMPLETE",
      reasons: [
        `Automated rule coverage is ${coveragePercentage.toFixed(1)}%, below the ${config.minimumCoveragePercent}% this tool treats as enough for a meaningful readiness claim.`,
      ],
    };
  }

  return { status: "READY", reasons: [] };
}
