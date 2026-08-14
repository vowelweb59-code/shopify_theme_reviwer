import type { ParsedFile } from "@/lib/theme-parser";
import { ALL_RULES } from "@/lib/rules/registry";
import type { FindingCategory, Rule, RuleFinding, Severity } from "./rules";
import { buildThemeIndex } from "./themeIndex";

export type ExecutedFinding = RuleFinding & {
  ruleId: string;
  requirementId?: string;
  sourceReference?: string;
  sourceUrl?: string;
};

export type RunRulesSummary = {
  total: number;
  blocker: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<string, number>;
};

export type RunRulesResult = {
  findings: ExecutedFinding[];
  summary: RunRulesSummary;
  ruleErrors: { ruleId: string; error: string }[];
};

function dedupeKey(f: ExecutedFinding): string {
  const normalized = f.finding.toLowerCase().replace(/\s+/g, " ").trim();
  return `${f.filePath}::${f.lineNumber ?? ""}::${f.category}::${normalized}`;
}

const EMPTY_SUMMARY = (): RunRulesSummary => ({ total: 0, blocker: 0, high: 0, medium: 0, low: 0, byCategory: {} });

/** Shared by runRules() and the live-check merge in the audit API route, so a summary always reflects the same counting logic regardless of which layer(s) contributed findings. */
export function summarizeFindings(findings: { severity: Severity; category: FindingCategory }[]): RunRulesSummary {
  const summary = EMPTY_SUMMARY();
  for (const f of findings) {
    summary.total++;
    summary[f.severity]++;
    summary.byCategory[f.category] = (summary.byCategory[f.category] ?? 0) + 1;
  }
  return summary;
}

/** Runs every rule against every parsed file. A failing rule is recorded and skipped — it never aborts the rest of the audit. */
export function runRules(files: ParsedFile[], rules: Rule[] = ALL_RULES): RunRulesResult {
  const index = buildThemeIndex(files);
  const findingsByKey = new Map<string, ExecutedFinding>();
  const ruleErrors: { ruleId: string; error: string }[] = [];

  for (const rule of rules) {
    try {
      const results = rule.check({ files, index });
      for (const r of results) {
        const finding: ExecutedFinding = {
          ...r,
          ruleId: rule.ruleId,
          requirementId: rule.requirementId,
          sourceReference: rule.sourceReference,
          sourceUrl: rule.sourceUrl,
        };
        const key = dedupeKey(finding);
        if (!findingsByKey.has(key)) findingsByKey.set(key, finding);
      }
    } catch (err) {
      ruleErrors.push({ ruleId: rule.ruleId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const findings = [...findingsByKey.values()];
  const summary = summarizeFindings(findings);

  return { findings, summary, ruleErrors };
}
