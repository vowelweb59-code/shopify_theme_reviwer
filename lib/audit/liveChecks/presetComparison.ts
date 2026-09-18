import type { ExecutedFinding } from "../runRules";
import type { PageFacts } from "./fetchPageFacts";

export type PresetFacts = { label: string; home: PageFacts; product?: PageFacts };

// The margin at which two presets' rendered section counts are treated as
// "the same layout, presets are allowed to differ a little" rather than a
// real structural drift worth flagging — one section added/removed for
// seasonal content is normal; a homepage with half as many sections as its
// sibling preset is a genuine inconsistency.
const SECTION_COUNT_DRIFT_THRESHOLD = 2;

/**
 * The "presets should be in sync" check (an internal quality standard, not
 * a documented Shopify rule — see INTERNAL-PRESET-SYNC-001), comparing
 * every preset's *actually rendered* homepage (and product page, where
 * both sides have one) against the first-listed preset, treated as "the
 * main theme" baseline the way the user framed it. Deliberately compares
 * rendered output, not config/settings_data.json: each preset is a
 * genuinely separate published theme install with its own admin-configured
 * content, so a live comparison catches real drift a static file diff
 * can't — verified against the Theme Store's own multi-preset themes
 * (e.g. Prestige), where each preset resolves to a distinct live store.
 */
export function comparePresets(presets: PresetFacts[]): ExecutedFinding[] {
  if (presets.length < 2) return [];
  const [baseline, ...rest] = presets;
  const findings: ExecutedFinding[] = [];

  for (const preset of rest) {
    for (const page of ["home", "product"] as const) {
      const basePage = baseline[page];
      const thisPage = preset[page];
      if (!basePage || !thisPage) continue; // one preset has no product page found — nothing to compare there

      const pageLabel = page === "home" ? "homepage" : "product page";
      const sectionDiff = Math.abs(basePage.sectionIds.length - thisPage.sectionIds.length);
      if (sectionDiff >= SECTION_COUNT_DRIFT_THRESHOLD) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-SECTIONS-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} renders ${thisPage.sectionIds.length} sections, versus ${basePage.sectionIds.length} on the baseline preset "${baseline.label}"'s ${pageLabel} (${basePage.url}) — a structural difference of ${sectionDiff}. Confirm this is an intentional design difference between presets, not a preset that's fallen out of sync.`,
          recommendation: `Compare the ${pageLabel} section composition between "${baseline.label}" and "${preset.label}" and reconcile any sections that were added to one preset but not carried over to the other.`,
        });
      }

      const missingTypes = basePage.jsonLdTypes.filter((t) => !thisPage.jsonLdTypes.includes(t));
      if (missingTypes.length > 0) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-JSONLD-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} is missing ${missingTypes.join(", ")} JSON-LD that the baseline preset "${baseline.label}"'s ${pageLabel} (${basePage.url}) has.`,
          recommendation: `Check why "${preset.label}" doesn't render the same structured data as "${baseline.label}" on this page — a disabled app/section, or a genuine regression in this preset.`,
        });
      }

      if (basePage.canonical && !thisPage.canonical) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-METADATA-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} has no canonical link tag, but the baseline preset "${baseline.label}"'s ${pageLabel} does.`,
          recommendation: `Add a canonical link tag to "${preset.label}"'s ${pageLabel}, matching "${baseline.label}".`,
        });
      }
      if (basePage.metaDescription && !thisPage.metaDescription) {
        findings.push({
          ruleId: "LIVE-PRESET-SYNC-METADATA-001",
          requirementId: "INTERNAL-PRESET-SYNC-001",
          filePath: thisPage.url,
          category: "Internal Standard",
          severity: "medium",
          finding: `Preset "${preset.label}"'s ${pageLabel} has no meta description, but the baseline preset "${baseline.label}"'s ${pageLabel} does.`,
          recommendation: `Add a meta description to "${preset.label}"'s ${pageLabel}, matching "${baseline.label}".`,
        });
      }
    }
  }

  return findings;
}
