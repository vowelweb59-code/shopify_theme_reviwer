import type { ParsedFile } from "@/lib/theme-parser";
import { ALL_RULES } from "@/lib/rules/registry";
import { Rule as RuleModel } from "@/models/rule";
import { runRules, type RunRulesResult } from "./runRules";

// Rule metadata (enabled/disabled) lives in Mongo, seeded from ALL_RULES by
// scripts/seed-rules.ts, so a user can disable a rule from the DB without a
// code change. If the Rule collection hasn't been seeded yet, nothing is
// marked disabled and every rule in code runs — seeding is a convenience,
// never a hard dependency for the audit pipeline to work.
export async function loadEnabledRules() {
  const disabledIds = await RuleModel.find({ enabled: false }).distinct("ruleId");
  if (disabledIds.length === 0) return ALL_RULES;
  const disabled = new Set(disabledIds);
  return ALL_RULES.filter((rule) => !disabled.has(rule.ruleId));
}

/** Runs the deterministic static rule engine (Phase 3) against a parsed theme. */
export async function runAuditRules(files: ParsedFile[]): Promise<RunRulesResult> {
  const rules = await loadEnabledRules();
  return runRules(files, rules);
}
