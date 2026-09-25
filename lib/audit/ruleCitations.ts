import { ALL_RULES } from "@/lib/rules/registry";

// A static finding's citation (sourceReference/sourceUrl) is its rule's
// citation, so it's not stored on every finding: it's left out at write
// time and filled back in from the rule registry whenever findings are
// read. Findings whose citation is their own — e.g. a PageSpeed finding
// linking to that specific Lighthouse audit — keep it stored.
//
// Trade-off, by decision (2026-09-25): an old run shows its rule's
// *current* citation if the rule's reference is later edited.

type Cited = { ruleId: string; sourceReference?: string | null; sourceUrl?: string | null };

const RULE_CITATIONS = new Map(ALL_RULES.map((r) => [r.ruleId, { sourceReference: r.sourceReference ?? null, sourceUrl: r.sourceUrl ?? null }]));

/** For writing: drops citation fields that just repeat the rule's own. */
export function withoutRuleCitation<T extends Cited>(finding: T): T {
  const rule = RULE_CITATIONS.get(finding.ruleId);
  if (!rule) return finding;
  const out = { ...finding };
  if (out.sourceReference != null && out.sourceReference === rule.sourceReference) delete out.sourceReference;
  if (out.sourceUrl != null && out.sourceUrl === rule.sourceUrl) delete out.sourceUrl;
  return out;
}

/** For reading: fills a missing citation from the finding's rule. */
export function withRuleCitations<T extends Cited>(findings: T[]): T[] {
  return findings.map((f) => {
    const rule = RULE_CITATIONS.get(f.ruleId);
    if (!rule || (f.sourceReference != null && f.sourceUrl != null)) return f;
    return { ...f, sourceReference: f.sourceReference ?? rule.sourceReference, sourceUrl: f.sourceUrl ?? rule.sourceUrl };
  });
}
