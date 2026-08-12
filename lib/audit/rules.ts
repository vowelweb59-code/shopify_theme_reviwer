import type { ParsedFile } from "@/lib/theme-parser";
import type { FINDING_CATEGORIES, FINDING_SEVERITIES } from "@/models/finding";

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export type Severity = (typeof FINDING_SEVERITIES)[number];

// Every rule receives every parsed file, not just "the current file" — most
// checks are per-file, but a few (e.g. "does an Organization schema exist
// anywhere in the theme?") are inherently theme-wide and don't need Phase 4's
// cross-file dependency graph to answer.
export type RuleContext = {
  files: ParsedFile[];
};

export type RuleFinding = {
  filePath: string;
  lineNumber?: number;
  category: FindingCategory;
  severity: Severity;
  finding: string;
  recommendation?: string;
};

export type Rule = {
  ruleId: string;
  requirementId?: string;
  category: FindingCategory;
  defaultSeverity: Severity;
  title: string;
  description: string;
  sourceReference?: string;
  sourceUrl?: string;
  check: (context: RuleContext) => RuleFinding[];
};
