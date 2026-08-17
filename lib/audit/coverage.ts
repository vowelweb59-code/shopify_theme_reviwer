export type CoverageResult = {
  total: number;
  implemented: number;
  partial: number;
  notImplemented: number;
  percentage: number;
};

/** Same computation the Rules page does client-side (phase-5 §4) — extracted here so the report API can surface it without duplicating the logic. */
export function computeCoverage(requirements: { ruleStatus: string }[]): CoverageResult {
  const total = requirements.length;
  const implemented = requirements.filter((r) => r.ruleStatus === "implemented").length;
  const partial = requirements.filter((r) => r.ruleStatus === "partial").length;
  const notImplemented = total - implemented - partial;
  const percentage = total === 0 ? 0 : (implemented / total) * 100;
  return { total, implemented, partial, notImplemented, percentage };
}

/** Per-category coverage (phase-5 §10's "Requirement coverage, Rules not yet implemented" per category dashboard). */
export function computeCoverageByCategory(requirements: { ruleStatus: string; category: string }[]): Record<string, CoverageResult> {
  const byCategory: Record<string, { ruleStatus: string }[]> = {};
  for (const r of requirements) {
    (byCategory[r.category] ??= []).push(r);
  }
  return Object.fromEntries(Object.entries(byCategory).map(([category, reqs]) => [category, computeCoverage(reqs)]));
}
