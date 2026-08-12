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

export const BUG_RULES: Rule[] = [validJsonLdRule, validSchemaBlockRule];
