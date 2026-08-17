// Re-audit comparison (phase-6 §4-8) — deliberately conservative. Only two
// match stages are implemented: an exact stable-signature match, and a
// same-rule/same-location match for a "changed" state. There is no
// source-context/line-shift fallback (phase-6's Stage 3) — an unmatched
// finding is reported as resolved/new rather than guessed at, which is
// exactly what the phase doc's own Stage 4 asks for when no reliable match
// exists. Manual finding status carry-forward and reintroduced-issue
// history are handled separately at persist time — see
// lib/audit/findingHistory.ts. Rule-version attribution for "new"
// findings is a separate enrichment pass — see attributeNewFindings below.
import { exactSignature, locationSignature, type DiffableFinding } from "./findingSignature";

export type { DiffableFinding };

export type DiffStatus = "resolved" | "still_present" | "new" | "changed";

// Only ever set on a "new" finding, by attributeNewFindings — distinguishes
// a finding that's new because a rule was added/changed (phase-6 §14) from
// one that's new because the theme itself changed.
export type NewFindingAttribution = "new_rule" | "rule_changed" | "theme_change";

export type DiffFinding<T extends DiffableFinding = DiffableFinding> = {
  status: DiffStatus;
  previous?: T;
  current?: T;
  newFindingAttribution?: NewFindingAttribution;
};

export type FindingsDiffSummary = {
  previousTotal: number;
  currentTotal: number;
  resolved: number;
  stillPresent: number;
  new: number;
  changed: number;
};

export type FindingsDiff<T extends DiffableFinding = DiffableFinding> = {
  summary: FindingsDiffSummary;
  findings: DiffFinding<T>[];
};

/**
 * Deterministically compares two sets of findings from the same theme's
 * audit history. Never relies on line number or array order — only
 * ruleId + category + filePath + normalized message, per phase-6 §4-5.
 */
export function computeFindingsDiff<T extends DiffableFinding>(previous: T[], current: T[]): FindingsDiff<T> {
  const currentByExact = new Map<string, T[]>();
  for (const f of current) {
    const key = exactSignature(f);
    const bucket = currentByExact.get(key);
    if (bucket) bucket.push(f);
    else currentByExact.set(key, [f]);
  }

  const currentByLocation = new Map<string, T[]>();
  for (const f of current) {
    const key = locationSignature(f);
    const bucket = currentByLocation.get(key);
    if (bucket) bucket.push(f);
    else currentByLocation.set(key, [f]);
  }

  const matchedCurrent = new Set<T>();
  const findings: DiffFinding<T>[] = [];

  for (const prev of previous) {
    const exactKey = exactSignature(prev);
    const exactBucket = currentByExact.get(exactKey);
    const exactMatch = exactBucket?.find((c) => !matchedCurrent.has(c));
    if (exactMatch) {
      matchedCurrent.add(exactMatch);
      findings.push({ status: "still_present", previous: prev, current: exactMatch });
      continue;
    }

    const locationKey = locationSignature(prev);
    const locationBucket = currentByLocation.get(locationKey);
    const locationMatch = locationBucket?.find((c) => !matchedCurrent.has(c));
    if (locationMatch) {
      matchedCurrent.add(locationMatch);
      findings.push({ status: "changed", previous: prev, current: locationMatch });
      continue;
    }

    findings.push({ status: "resolved", previous: prev });
  }

  for (const cur of current) {
    if (!matchedCurrent.has(cur)) {
      findings.push({ status: "new", current: cur });
    }
  }

  const summary: FindingsDiffSummary = {
    previousTotal: previous.length,
    currentTotal: current.length,
    resolved: findings.filter((f) => f.status === "resolved").length,
    stillPresent: findings.filter((f) => f.status === "still_present").length,
    new: findings.filter((f) => f.status === "new").length,
    changed: findings.filter((f) => f.status === "changed").length,
  };

  return { summary, findings };
}

export type CategoryDiffSummary = {
  category: string;
  resolved: number;
  new: number;
  stillPresent: number;
  changed: number;
};

/** Per-category breakdown of a diff (phase-6 §8's category-change example). */
export function summarizeDiffByCategory<T extends DiffableFinding>(diff: FindingsDiff<T>): CategoryDiffSummary[] {
  const byCategory = new Map<string, CategoryDiffSummary>();
  for (const f of diff.findings) {
    const category = (f.current ?? f.previous)!.category;
    const entry = byCategory.get(category) ?? { category, resolved: 0, new: 0, stillPresent: 0, changed: 0 };
    if (f.status === "resolved") entry.resolved++;
    else if (f.status === "new") entry.new++;
    else if (f.status === "still_present") entry.stillPresent++;
    else if (f.status === "changed") entry.changed++;
    byCategory.set(category, entry);
  }
  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
}

export type SeverityDiffSummary = {
  severity: string;
  previousCount: number;
  currentCount: number;
  resolved: number;
  new: number;
};

const SEVERITY_ORDER = ["blocker", "high", "medium", "low"];

/** Per-severity before/after counts (phase-6 §8's blocker example) — the basis for a "new blockers introduced" regression callout. */
export function summarizeDiffBySeverity<T extends DiffableFinding>(diff: FindingsDiff<T>): SeverityDiffSummary[] {
  return SEVERITY_ORDER.map((severity) => {
    const previousCount = diff.findings.filter((f) => f.previous?.severity === severity).length;
    const currentCount = diff.findings.filter((f) => f.current?.severity === severity).length;
    const resolved = diff.findings.filter((f) => f.status === "resolved" && f.previous?.severity === severity).length;
    const newCount = diff.findings.filter((f) => f.status === "new" && f.current?.severity === severity).length;
    return { severity, previousCount, currentCount, resolved, new: newCount };
  });
}

/** New or severity-escalated blocker/high findings — the regression signal phase-6 §20 asks to make prominent. Excludes "new_rule"-attributed findings (see attributeNewFindings) so shipping a new rule doesn't itself trigger a false regression alert. */
export function countNewOrEscalatedHighRiskFindings<T extends DiffableFinding>(diff: FindingsDiff<T>): number {
  const highRisk = new Set(["blocker", "high"]);
  return diff.findings.filter((f) => {
    if (f.status === "new") return highRisk.has(f.current!.severity) && f.newFindingAttribution !== "new_rule";
    if (f.status === "changed") return highRisk.has(f.current!.severity) && !highRisk.has(f.previous!.severity);
    return false;
  }).length;
}

/**
 * Distinguishes a "new" finding caused by a newly-added or changed rule
 * from one caused by an actual theme change (phase-6 §14) — otherwise the
 * very first audit run after shipping a new rule would report every one
 * of its findings as a fresh regression, even though nothing in the theme
 * changed. Only ever annotates "new" findings; every other status passes
 * through unchanged. Both version maps come from AuditRun.ruleVersionSnapshot,
 * captured at persist time for exactly this comparison.
 */
export function attributeNewFindings<T extends DiffableFinding>(
  findings: DiffFinding<T>[],
  baselineRuleVersions: Record<string, number>,
  currentRuleVersions: Record<string, number>
): DiffFinding<T>[] {
  return findings.map((f) => {
    if (f.status !== "new") return f;
    const ruleId = f.current!.ruleId;
    const baselineVersion = baselineRuleVersions[ruleId];
    const currentVersion = currentRuleVersions[ruleId];
    let attribution: NewFindingAttribution;
    if (baselineVersion === undefined) attribution = "new_rule";
    else if (baselineVersion !== currentVersion) attribution = "rule_changed";
    else attribution = "theme_change";
    return { ...f, newFindingAttribution: attribution };
  });
}
