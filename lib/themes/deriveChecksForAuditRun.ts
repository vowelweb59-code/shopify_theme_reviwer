import { Requirement } from "@/models/requirement";
import { Rule } from "@/models/rule";
import { Finding } from "@/models/finding";
import { FINDING_CATEGORIES } from "@/models/finding";

export type CheckStatus = "PASS" | "FAIL" | "WARNING" | "NOT_TESTED";

export type CheckEvidence = {
  filePath: string;
  lineNumber: number | null;
  sourceSnippet: string | null;
  severity: string;
  finding: string;
};

export type CheckItem = {
  key: string; // requirementId, or ruleId when there's no requirement mapping
  requirementId: string | null;
  ruleId: string | null;
  title: string;
  description: string;
  category: string;
  sourceName: string | null;
  sourceUrl: string | null;
  status: CheckStatus;
  recommendation: string | null;
  evidence: CheckEvidence[];
};

export type CategoryChecks = { category: string; items: CheckItem[] };

function severityBucket(matches: { severity: string }[]): "PASS" | "FAIL" | "WARNING" {
  if (matches.length === 0) return "PASS";
  const hasHighSeverity = matches.some((m) => m.severity === "blocker" || m.severity === "high");
  return hasHighSeverity ? "FAIL" : "WARNING";
}

/**
 * Every check the existing audit engine supports, for one specific
 * AuditRun, with a derived PASS/FAIL/WARNING/NOT_TESTED status — nothing
 * new is persisted for this; it's computed from the existing Requirement/
 * Rule catalog (same join app/api/maintenance/route.ts already does) joined
 * against this run's own Finding rows. A rule that ran and produced no
 * Finding is a PASS; one that never runs without a live demo URL (a
 * LIVE-* check with no requirement-level Rule doc — see scripts/seed-rules.ts's
 * live-check regex scan) is NOT_TESTED unless this run actually had a demo
 * store URL.
 */
export async function deriveChecksForAuditRun(
  auditRunId: unknown,
  hadLiveChecks: boolean
): Promise<{ categories: CategoryChecks[]; totals: { total: number; passed: number; failed: number; warnings: number; notTested: number } }> {
  const [requirements, rules, findings] = await Promise.all([
    Requirement.find({ status: "active" }).sort({ requirementId: 1 }).lean(),
    Rule.find({ enabled: true }).lean(),
    Finding.find({ auditRunId }).select("ruleId requirementId category severity filePath lineNumber sourceSnippet finding recommendation").lean(),
  ]);

  const ruleByRequirementId = new Map(rules.filter((r) => r.requirementId).map((r) => [r.requirementId as string, r]));
  const findingsByRequirementId = new Map<string, typeof findings>();
  const findingsByRuleId = new Map<string, typeof findings>();
  for (const f of findings) {
    if (f.requirementId) {
      const list = findingsByRequirementId.get(f.requirementId) ?? [];
      list.push(f);
      findingsByRequirementId.set(f.requirementId, list);
    }
    const byRule = findingsByRuleId.get(f.ruleId) ?? [];
    byRule.push(f);
    findingsByRuleId.set(f.ruleId, byRule);
  }

  function toEvidence(matches: typeof findings): CheckEvidence[] {
    return matches.map((m) => ({
      filePath: m.filePath,
      lineNumber: m.lineNumber ?? null,
      sourceSnippet: m.sourceSnippet ?? null,
      severity: m.severity,
      finding: m.finding,
    }));
  }

  const items: CheckItem[] = [];

  for (const req of requirements) {
    const rule = ruleByRequirementId.get(req.requirementId);
    const notImplemented = req.ruleStatus === "not_implemented";
    const isLiveOnly = !notImplemented && !rule;

    let status: CheckStatus;
    let matches: typeof findings = [];
    if (notImplemented) {
      status = "NOT_TESTED";
    } else if (isLiveOnly && !hadLiveChecks) {
      status = "NOT_TESTED";
    } else {
      matches = findingsByRequirementId.get(req.requirementId) ?? [];
      status = severityBucket(matches);
    }

    items.push({
      key: req.requirementId,
      requirementId: req.requirementId,
      ruleId: rule?.ruleId ?? null,
      title: req.title,
      description: req.description,
      category: req.category,
      sourceName: req.sourceName ?? null,
      sourceUrl: req.sourceUrl ?? null,
      status,
      recommendation: matches[0]?.recommendation ?? null,
      evidence: toEvidence(matches),
    });
  }

  // Rules with no requirement mapping (e.g. cross-file/bug consistency
  // checks) never appear via the Requirement loop above but are just as
  // real a check the engine runs — included so "All Checks" is genuinely
  // every rule, not just the ones with a Shopify/A11y requirement behind them.
  for (const rule of rules) {
    if (rule.requirementId) continue;
    const matches = findingsByRuleId.get(rule.ruleId) ?? [];
    items.push({
      key: rule.ruleId,
      requirementId: null,
      ruleId: rule.ruleId,
      title: rule.title,
      description: rule.description,
      category: rule.category,
      sourceName: rule.sourceReference ?? null,
      sourceUrl: rule.sourceUrl ?? null,
      status: severityBucket(matches),
      recommendation: matches[0]?.recommendation ?? null,
      evidence: toEvidence(matches),
    });
  }

  const byCategory = new Map<string, CheckItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const categories: CategoryChecks[] = FINDING_CATEGORIES.filter((c) => byCategory.has(c)).map((c) => ({
    category: c,
    items: byCategory.get(c)!,
  }));

  const totals = {
    total: items.length,
    passed: items.filter((i) => i.status === "PASS").length,
    failed: items.filter((i) => i.status === "FAIL").length,
    warnings: items.filter((i) => i.status === "WARNING").length,
    notTested: items.filter((i) => i.status === "NOT_TESTED").length,
  };

  return { categories, totals };
}
