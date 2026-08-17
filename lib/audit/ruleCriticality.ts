export type RuleCriticality = "critical" | "important" | "informational";

/**
 * A defensible default, not a hand-curated judgment per rule (phase-7
 * §17) — computed once at seed time from category + severity, not stored
 * as an independent opinion. "Critical": an official Shopify Theme Store
 * Compliance rule at blocker/high severity, since failing one of these is
 * the most direct submission risk. "Important": any other blocker/high
 * rule, or a medium-severity Accessibility/Technical SEO/Technical AEO
 * rule — real user-facing or search-visibility impact, just not an
 * outright submission blocker. Everything else (low severity, or a
 * medium-severity Bug/Internal Standard) is "informational".
 */
export function computeRuleCriticality(category: string, severity: string): RuleCriticality {
  const highRisk = severity === "blocker" || severity === "high";
  if (category === "Theme Store Compliance" && highRisk) return "critical";
  if (highRisk) return "important";
  if (severity === "medium" && (category === "Accessibility" || category === "Technical SEO" || category === "Technical AEO")) {
    return "important";
  }
  return "informational";
}
