import type { ExecutedFinding } from "../runRules";
import type { LighthouseResult } from "../psi";

// Lighthouse can list dozens of failing elements on a busy page — one
// finding per failing element would flood the report; a handful of
// concrete examples is enough to act on, matching how the old Playwright-
// based sampling capped itself too.
const MAX_ITEM_FINDINGS = 10;

function nodeOf(item: Record<string, unknown>): { selector?: string; explanation?: string; nodeLabel?: string } | undefined {
  const node = item.node;
  return node && typeof node === "object" ? (node as { selector?: string; explanation?: string; nodeLabel?: string }) : undefined;
}

// Lighthouse's own axe-core explanation text is prefixed with "Fix any of
// the following:\n  " boilerplate before the actual, useful sentence
// (element + computed contrast ratio + expected ratio) — stripped so the
// finding reads as one clean sentence instead of two lines glued together.
function cleanExplanation(explanation: string | undefined): string | undefined {
  if (!explanation) return undefined;
  return explanation.replace(/^Fix any of the following:\s*/i, "").trim();
}

/**
 * Derives contrast findings from PageSpeed Insights' own `color-contrast`
 * Lighthouse audit — a real Chrome instance run on Google's infrastructure,
 * with real computed contrast ratios per failing element, sourced from the
 * exact same PSI call already made for performance metrics (no extra
 * request, no local browser). Replaces the old Playwright-based contrast
 * sampling in lib/audit/liveCheck.ts.
 */
export function contrastFindingsFromPsi(label: string, url: string, lhr: LighthouseResult): ExecutedFinding[] {
  const audit = lhr.audits?.["color-contrast"];
  const items = audit?.details?.items;
  if (!Array.isArray(items) || items.length === 0) return [];

  const findings: ExecutedFinding[] = [];
  for (const item of items.slice(0, MAX_ITEM_FINDINGS)) {
    const node = nodeOf(item);
    if (!node?.selector) continue;
    const explanation = cleanExplanation(node.explanation);
    findings.push({
      ruleId: "LIVE-CONTRAST-001",
      requirementId: "SHOPIFY-A11Y-004",
      filePath: url,
      category: "Accessibility",
      presetLabel: label,
      severity: "medium",
      finding: `"${node.selector}" fails Lighthouse's automated contrast check${explanation ? `: ${explanation}` : "."}`,
      recommendation: "Increase the contrast between this text color and its background to meet WCAG AA (4.5:1).",
    });
  }
  return findings;
}

/**
 * Derives touch-target-sizing findings from PSI's `target-size` Lighthouse
 * audit (the current name for what used to be called "tap-targets") —
 * same data source and reasoning as contrastFindingsFromPsi above. Replaces
 * the old Playwright-based touch-target sampling in liveCheck.ts.
 */
export function touchTargetFindingsFromPsi(label: string, url: string, lhr: LighthouseResult): ExecutedFinding[] {
  const audit = lhr.audits?.["target-size"];
  const items = audit?.details?.items;
  if (!Array.isArray(items) || items.length === 0) return [];

  const findings: ExecutedFinding[] = [];
  for (const item of items.slice(0, MAX_ITEM_FINDINGS)) {
    const node = nodeOf(item);
    if (!node?.selector) continue;
    const explanation = cleanExplanation(node.explanation);
    findings.push({
      ruleId: "LIVE-A11Y-TOUCH-TARGET-001",
      requirementId: "SHOPIFY-A11Y-006",
      filePath: url,
      category: "Accessibility",
      presetLabel: label,
      severity: "medium",
      finding: `"${node.selector}" fails Lighthouse's automated touch-target size check${explanation ? `: ${explanation}` : "."}`,
      recommendation: "Increase this control's rendered size (padding, min-width/min-height) to at least 24×24 CSS pixels.",
    });
  }
  return findings;
}
