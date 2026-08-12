// Internal team standards — independent of Shopify's own requirements (see
// phase-3's rule that these must never be reported as Theme Store
// violations). Historically empty because no internal convention had been
// provided; INTERNAL-CONTENT-HEADING-001 is the team's first one.
import type { Rule } from "@/lib/audit/rules";
import { resolveSchemaString } from "@/lib/audit/themeIndex";

function findHeadingSetting(settings: unknown): { default: string } | undefined {
  if (!Array.isArray(settings)) return undefined;
  for (const setting of settings) {
    if (!setting || typeof setting !== "object") continue;
    const obj = setting as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    const label = typeof obj.label === "string" ? obj.label : "";
    const isHeadingSetting = id.toLowerCase() === "heading" || label.trim().toLowerCase() === "heading";
    if (isHeadingSetting && typeof obj.default === "string" && obj.default.trim() !== "") {
      return { default: obj.default };
    }
  }
  return undefined;
}

const headingMatchesSectionNameRule: Rule = {
  ruleId: "INTERNAL-CONTENT-HEADING-001",
  category: "Internal Standard",
  defaultSeverity: "low",
  title: "Section heading placeholder should match the section's customizer name",
  description:
    "Team convention: for a section with a \"heading\" setting, that setting's default (placeholder) text should match the section's own \"name\" as shown in the theme editor's section list.",
  // Team-specific convention, not a Shopify requirement — no requirementId,
  // per phase-3's rule that internal standards must stand on their own.
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid" || !f.path.startsWith("sections/")) continue;
      const schema = f.schemaBlocks[0];
      if (!schema?.json) continue;
      const rawName = typeof schema.json.name === "string" ? schema.json.name : undefined;
      if (!rawName) continue;
      // Schema name/default values are routinely a "t:sections.x.name"
      // translation key rather than literal text (every professionally
      // localized theme, including Shopify's own Dawn, does this) —
      // comparing the raw "t:..." strings would be meaningless. Skip
      // entirely if either side can't be resolved to actual text, rather
      // than risk a false comparison.
      const name = resolveSchemaString(index, rawName);
      if (!name) continue;
      const heading = findHeadingSetting(schema.json.settings);
      if (!heading) continue;
      const headingDefault = resolveSchemaString(index, heading.default);
      if (!headingDefault) continue;
      if (headingDefault.trim().toLowerCase() === name.trim().toLowerCase()) continue;
      findings.push({
        filePath: f.path,
        lineNumber: schema.line,
        category: "Internal Standard" as const,
        severity: "low" as const,
        finding: `Section is named "${name}" in the customizer, but its heading setting defaults to "${headingDefault}" — these should match.`,
        recommendation: `Set the heading setting's default to "${name}" (or rename the section to match the intended heading text).`,
      });
    }
    return findings;
  },
};

export const INTERNAL_RULES: Rule[] = [headingMatchesSectionNameRule];
