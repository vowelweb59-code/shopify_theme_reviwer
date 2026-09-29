// Section-support requirements checked from each section's {% schema %}.
// Added 2026-09-29: the Aspire theme was rejected at Stage 1 for missing a
// Custom Liquid section, and SHOPIFY-STRUCTURE-003 had no rule behind it.
import type { Rule, RuleFinding } from "@/lib/audit/rules";
import type { ParsedFile } from "@/lib/theme-parser";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";

function hasLiquidSetting(settings: unknown): boolean {
  return Array.isArray(settings) && settings.some((s) => s && typeof s === "object" && (s as Record<string, unknown>).type === "liquid");
}

/** Why a section with a liquid setting still isn't addable on every template, or null if it is. */
function availabilityProblem(schema: Record<string, unknown>): string | null {
  const presets = schema.presets;
  if (!Array.isArray(presets) || presets.length === 0) {
    return "has no presets, so merchants can't add it from the theme editor";
  }
  // Legacy `templates` restricts a section to the listed templates.
  if (Array.isArray(schema.templates) && schema.templates.length > 0) {
    return `is limited to these templates by "templates": ${schema.templates.join(", ")}`;
  }
  const enabledOn = schema.enabled_on as Record<string, unknown> | undefined;
  if (enabledOn && typeof enabledOn === "object") {
    const templates = enabledOn.templates;
    if (!Array.isArray(templates) || templates.length === 0) {
      return "has \"enabled_on\" without templates, so it can only be added to section groups";
    }
    if (!templates.includes("*")) return `is limited to these templates by "enabled_on": ${templates.join(", ")}`;
  }
  const disabledOn = schema.disabled_on as Record<string, unknown> | undefined;
  if (disabledOn && typeof disabledOn === "object" && Array.isArray(disabledOn.templates) && disabledOn.templates.length > 0) {
    return `is disabled on these templates by "disabled_on": ${disabledOn.templates.join(", ")}`;
  }
  return null;
}

function schemaOf(file: ParsedFile): Record<string, unknown> | null {
  return file.schemaBlocks[0]?.json ?? null;
}

const customLiquidSectionRule: Rule = {
  ruleId: "SHOPIFY-SECTIONS-CUSTOM-LIQUID-001",
  requirementId: "SHOPIFY-STRUCTURE-003",
  category: "Theme Store Compliance",
  defaultSeverity: "blocker",
  title: "Theme must include a Custom Liquid section available on every template",
  description:
    "Themes must include a Custom Liquid section: a section (not just a block) whose own settings include a setting of type liquid, with presets and no templates/enabled_on/disabled_on restriction, so it can be added on every template that supports sections. It acts as an insertion point for some apps. A Stage 1 Theme Store rejection reason.",
  sourceReference: "Shopify Theme Store requirements — Section support",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const sections = files.filter((f) => f.fileType === "liquid" && f.path.startsWith("sections/"));
    const candidates = sections.filter((f) => hasLiquidSetting(schemaOf(f)?.settings));

    const problems: { file: ParsedFile; problem: string }[] = [];
    for (const file of candidates) {
      const problem = availabilityProblem(schemaOf(file)!);
      if (!problem) return []; // one qualifying section is enough
      problems.push({ file, problem });
    }

    if (problems.length > 0) {
      return problems.map(({ file, problem }): RuleFinding => ({
        filePath: file.path,
        lineNumber: file.schemaBlocks[0]?.line,
        category: "Theme Store Compliance",
        severity: "blocker",
        finding: `This section has a liquid setting but ${problem} — the Custom Liquid section must be available on all templates that support sections.`,
        recommendation: "Give the section a preset and remove its templates/enabled_on/disabled_on template restriction (or use \"templates\": [\"*\"]).",
      }));
    }

    // A liquid setting only on blocks (section blocks or theme blocks)
    // doesn't satisfy the requirement — say so, since it's the usual
    // near-miss and otherwise looks like the rule missed it.
    const blockOnly =
      files.find((f) => f.fileType === "liquid" && f.path.startsWith("blocks/") && hasLiquidSetting(schemaOf(f)?.settings)) ??
      sections.find((f) => {
        const blocks = schemaOf(f)?.blocks;
        return Array.isArray(blocks) && blocks.some((b) => b && typeof b === "object" && hasLiquidSetting((b as Record<string, unknown>).settings));
      });
    const anchor = blockOnly ?? sections[0] ?? files.find((f) => f.path.startsWith("layout/"));
    return [
      {
        filePath: anchor?.path ?? "sections/",
        lineNumber: blockOnly?.schemaBlocks[0]?.line,
        category: "Theme Store Compliance",
        severity: "blocker",
        finding: blockOnly
          ? "A liquid setting exists only on a block, not on a section's own settings — the theme has no Custom Liquid section."
          : "No section declares a setting of type liquid — the theme has no Custom Liquid section.",
        recommendation:
          'Add sections/custom-liquid.liquid with a {"type": "liquid", "id": "custom_liquid"} setting, render {{ section.settings.custom_liquid }}, and give it a preset.',
      },
    ];
  },
};

export const SHOPIFY_SECTION_RULES: Rule[] = [customLiquidSectionRule];
