import type { ParsedFile } from "@/lib/theme-parser";
import type { FINDING_CATEGORIES, FINDING_SEVERITIES } from "@/models/finding";
import type { ThemeIndex } from "./themeIndex";

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export type Severity = (typeof FINDING_SEVERITIES)[number];

// Every rule receives every parsed file, not just "the current file" — most
// Phase 3 checks are per-file and only destructure `files`. Phase 4 cross-file
// rules (section/snippet/asset/locale resolution) additionally use `index`,
// the theme-wide index built once per run (see themeIndex.ts, runRules.ts).
export type RuleContext = {
  files: ParsedFile[];
  index: ThemeIndex;
};

export type RuleFinding = {
  filePath: string;
  lineNumber?: number;
  category: FindingCategory;
  severity: Severity;
  finding: string;
  recommendation?: string;
  // Which preset (of possibly several live demo URLs) this finding came
  // from — set by lib/audit/liveChecks/ and pageSpeed.ts for per-preset
  // live findings, undefined for every static finding and for the cross-preset
  // comparison findings themselves (those are about the relationship
  // between presets, not about any one of them).
  presetLabel?: string | null;
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
