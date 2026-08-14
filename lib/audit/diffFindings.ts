// Re-audit comparison (phase-6 §4-8) — deliberately conservative. Only two
// match stages are implemented: an exact stable-signature match, and a
// same-rule/same-location match for a "changed" state. There is no
// source-context/line-shift fallback (phase-6's Stage 3) — an unmatched
// finding is reported as resolved/new rather than guessed at, which is
// exactly what the phase doc's own Stage 4 asks for when no reliable match
// exists. Manual finding status (open/resolved/ignored), rule-version
// tracking, and reintroduced-issue history are not implemented here.

export type DiffableFinding = {
  ruleId: string;
  category: string;
  filePath: string;
  severity: "blocker" | "high" | "medium" | "low";
  finding: string;
  layer?: "static" | "live";
};

export type DiffStatus = "resolved" | "still_present" | "new" | "changed";

export type DiffFinding<T extends DiffableFinding = DiffableFinding> = {
  status: DiffStatus;
  previous?: T;
  current?: T;
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

function normalizeMessage(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ").replace(/['"]/g, '"');
}

function exactSignature(f: DiffableFinding): string {
  return `${f.ruleId}::${f.category}::${f.filePath}::${normalizeMessage(f.finding)}`;
}

function locationSignature(f: DiffableFinding): string {
  return `${f.ruleId}::${f.category}::${f.filePath}`;
}

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
