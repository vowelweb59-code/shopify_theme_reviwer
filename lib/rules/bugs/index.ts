import type { Rule } from "@/lib/audit/rules";

const GOOGLE_SD_POLICIES_URL = "https://developers.google.com/search/docs/appearance/structured-data/sd-policies";
const SECTION_SCHEMA_URL = "https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema";

const validJsonLdRule: Rule = {
  ruleId: "AEO-JSONLD-VALID-001",
  requirementId: "TECH-AEO-VALID-001",
  category: "Bug",
  defaultSeverity: "blocker",
  title: "JSON-LD blocks must be valid JSON",
  description: "Any JSON-LD block present must parse as valid JSON — a malformed block breaks the structured-data implementation entirely.",
  sourceReference: "Google: General structured data guidelines",
  sourceUrl: GOOGLE_SD_POLICIES_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const block of f.jsonLdBlocks) {
        if (block.parseError) {
          findings.push({
            filePath: f.path,
            lineNumber: block.line,
            category: "Bug" as const,
            severity: "blocker" as const,
            finding: `JSON-LD block does not parse as valid JSON: ${block.parseError}`,
            recommendation: "Fix the JSON syntax in this structured-data block.",
          });
        }
      }
    }
    return findings;
  },
};

const validSchemaBlockRule: Rule = {
  ruleId: "SCHEMA-JSON-VALID-001",
  requirementId: "SHOPIFY-SCHEMA-001",
  category: "Bug",
  defaultSeverity: "blocker",
  title: "{% schema %} tags must contain only valid JSON",
  description: "Each section/block can have a single {% schema %} tag, and it must contain only valid JSON.",
  sourceReference: "Shopify: Section schema",
  sourceUrl: SECTION_SCHEMA_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const block of f.schemaBlocks) {
        if (block.parseError) {
          findings.push({
            filePath: f.path,
            lineNumber: block.line,
            category: "Bug" as const,
            severity: "blocker" as const,
            finding: `{% schema %} block does not parse as valid JSON: ${block.parseError}`,
            recommendation: "Fix the JSON syntax inside this schema block — a malformed schema breaks the section in the theme editor.",
          });
        }
      }
    }
    return findings;
  },
};

function collectSchemaSettingIds(schemaJson: Record<string, unknown>): { ownIds: Set<string>; blockIds: Set<string> } {
  const ownIds = new Set<string>();
  const blockIds = new Set<string>();

  const settings = Array.isArray(schemaJson.settings) ? schemaJson.settings : [];
  for (const setting of settings) {
    const id = setting && typeof setting === "object" ? (setting as Record<string, unknown>).id : undefined;
    if (typeof id === "string") ownIds.add(id);
  }

  const blocks = Array.isArray(schemaJson.blocks) ? schemaJson.blocks : [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const blockSettings = (block as Record<string, unknown>).settings;
    if (!Array.isArray(blockSettings)) continue;
    for (const setting of blockSettings) {
      const id = setting && typeof setting === "object" ? (setting as Record<string, unknown>).id : undefined;
      if (typeof id === "string") blockIds.add(id);
    }
  }

  return { ownIds, blockIds };
}

const missingScopedSettingRule: Rule = {
  ruleId: "REF-SETTINGS-SCOPED-MISSING-001",
  category: "Bug",
  defaultSeverity: "medium",
  title: "section.settings.x / block.settings.x must be declared in that section's own schema",
  description:
    "section.settings.x must resolve to an id in this section's own {% schema %} \"settings\" array, and block.settings.x must resolve to an id declared under any block type's \"settings\" array in the same schema — each section declares these independently, unlike global settings.x.",
  // Only enforced for section files (which own a schema) — a snippet using
  // section.settings.x/block.settings.x could be rendered from any number of
  // different sections/block types with no static way to know which, so
  // checking it there would risk exactly the false positives phase-4 warns
  // about for cross-file component splits.
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid" || !f.path.startsWith("sections/")) continue;
      const schema = f.schemaBlocks[0];
      if (!schema?.json) continue; // missing/malformed schema is already flagged by validSchemaBlockRule
      const { ownIds, blockIds } = collectSchemaSettingIds(schema.json);

      for (const ref of f.settingReferences) {
        if (ref.scope === "section" && !ownIds.has(ref.key)) {
          findings.push({
            filePath: f.path,
            lineNumber: ref.line,
            category: "Bug" as const,
            severity: "medium" as const,
            finding: `References section.settings.${ref.key}, but no setting with that id is declared in this section's own schema.`,
            recommendation: `Add a setting with id "${ref.key}" to this section's {% schema %} "settings" array, or fix the reference.`,
          });
        } else if (ref.scope === "block" && !blockIds.has(ref.key)) {
          findings.push({
            filePath: f.path,
            lineNumber: ref.line,
            category: "Bug" as const,
            severity: "medium" as const,
            finding: `References block.settings.${ref.key}, but no block type in this section's schema declares a setting with that id.`,
            recommendation: `Add a setting with id "${ref.key}" to the relevant block type's "settings" array in this section's schema, or fix the reference.`,
          });
        }
      }
    }
    return findings;
  },
};

export const BUG_RULES: Rule[] = [validJsonLdRule, validSchemaBlockRule, missingScopedSettingRule];
