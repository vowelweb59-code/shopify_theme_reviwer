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

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function stringIdsOf(items: unknown, field = "id"): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>)[field] : undefined))
    .filter((x): x is string => typeof x === "string");
}

const duplicateSchemaIdRule: Rule = {
  ruleId: "SCHEMA-DUPLICATE-ID-001",
  category: "Bug",
  defaultSeverity: "high",
  title: "Schema settings/blocks must not declare duplicate ids or types",
  description:
    "Within a single {% schema %}: each top-level setting id must be unique, each block type's own settings ids must be unique within that block type, and block \"type\" values must be unique among the declared blocks. A duplicate id means only the last definition is ever used, silently dropping the others.",
  sourceReference: "Shopify: Section schema",
  sourceUrl: SECTION_SCHEMA_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      const schema = f.schemaBlocks[0];
      if (!schema?.json) continue; // missing/malformed schema is already flagged by validSchemaBlockRule
      const json = schema.json;

      for (const dup of findDuplicates(stringIdsOf(json.settings))) {
        findings.push({
          filePath: f.path,
          lineNumber: schema.line,
          category: "Bug" as const,
          severity: "high" as const,
          finding: `Schema declares the setting id "${dup}" more than once in its "settings" array — only the last definition is ever used.`,
          recommendation: `Remove or rename the duplicate "${dup}" setting.`,
        });
      }

      const blocks = Array.isArray(json.blocks) ? json.blocks : [];
      for (const dup of findDuplicates(stringIdsOf(blocks, "type"))) {
        findings.push({
          filePath: f.path,
          lineNumber: schema.line,
          category: "Bug" as const,
          severity: "high" as const,
          finding: `Schema declares the block type "${dup}" more than once in its "blocks" array.`,
          recommendation: `Remove or rename the duplicate "${dup}" block type.`,
        });
      }

      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const type = (block as Record<string, unknown>).type;
        const label = typeof type === "string" ? type : "(unknown)";
        for (const dup of findDuplicates(stringIdsOf((block as Record<string, unknown>).settings))) {
          findings.push({
            filePath: f.path,
            lineNumber: schema.line,
            category: "Bug" as const,
            severity: "high" as const,
            finding: `Block type "${label}" declares the setting id "${dup}" more than once in its "settings" array.`,
            recommendation: `Remove or rename the duplicate "${dup}" setting in the "${label}" block type.`,
          });
        }
      }
    }
    return findings;
  },
};

function findDuplicateLines(values: { value: string | null | undefined; line: number }[]): Map<string, number[]> {
  const byValue = new Map<string, number[]>();
  for (const { value, line } of values) {
    if (!value) continue;
    const lines = byValue.get(value) ?? [];
    lines.push(line);
    byValue.set(value, lines);
  }
  const dupes = new Map<string, number[]>();
  for (const [value, lines] of byValue) {
    if (lines.length > 1) dupes.set(value, lines);
  }
  return dupes;
}

const duplicateAssetLoadingRule: Rule = {
  ruleId: "PERF-DUPLICATE-ASSET-001",
  requirementId: "TECH-PERF-DUPLICATE-ASSET-001",
  category: "Bug",
  defaultSeverity: "low",
  title: "No duplicate script/stylesheet loading within a file",
  description: "The same script src or stylesheet href should not be loaded more than once within the same file.",
  sourceReference: "General technical performance best practice",
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const [src, lines] of findDuplicateLines(f.scripts.map((s) => ({ value: s.src, line: s.line })))) {
        findings.push({
          filePath: f.path,
          lineNumber: lines[1],
          category: "Bug" as const,
          severity: "low" as const,
          finding: `Script "${src}" is loaded ${lines.length} times in this file (lines ${lines.join(", ")}).`,
          recommendation: "Load this script once.",
        });
      }
      for (const [href, lines] of findDuplicateLines(f.stylesheets.map((s) => ({ value: s.href, line: s.line })))) {
        findings.push({
          filePath: f.path,
          lineNumber: lines[1],
          category: "Bug" as const,
          severity: "low" as const,
          finding: `Stylesheet "${href}" is loaded ${lines.length} times in this file (lines ${lines.join(", ")}).`,
          recommendation: "Load this stylesheet once.",
        });
      }
    }
    return findings;
  },
};

// 10KB is a widely-cited rule of thumb for "large enough that caching would
// help" (e.g. Lighthouse's own inline-script guidance) — not an exact
// science, but a defensible, documented line rather than an arbitrary one.
const LARGE_INLINE_PAYLOAD_BYTES = 10_000;

const largeInlinePayloadRule: Rule = {
  ruleId: "PERF-LARGE-INLINE-001",
  requirementId: "TECH-PERF-INLINE-PAYLOAD-001",
  category: "Bug",
  defaultSeverity: "low",
  title: "Large inline scripts/styles should be extracted to external files",
  description: "An inline <script> or <style> block over roughly 10KB should be moved to an external, cacheable asset file.",
  sourceReference: "General technical performance best practice",
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const script of f.scripts) {
        if (script.inline && (script.contentLength ?? 0) > LARGE_INLINE_PAYLOAD_BYTES) {
          findings.push({
            filePath: f.path,
            lineNumber: script.line,
            category: "Bug" as const,
            severity: "low" as const,
            finding: `Inline <script> is ~${Math.round((script.contentLength ?? 0) / 1000)}KB — too large to benefit from browser caching the way an external file would.`,
            recommendation: "Move this script's content to an external asset file loaded with a src attribute.",
          });
        }
      }
      for (const sheet of f.stylesheets) {
        if (sheet.inline && (sheet.contentLength ?? 0) > LARGE_INLINE_PAYLOAD_BYTES) {
          findings.push({
            filePath: f.path,
            lineNumber: sheet.line,
            category: "Bug" as const,
            severity: "low" as const,
            finding: `Inline <style> block is ~${Math.round((sheet.contentLength ?? 0) / 1000)}KB — too large to benefit from browser caching the way an external file would.`,
            recommendation: "Move this CSS to an external stylesheet asset.",
          });
        }
      }
    }
    return findings;
  },
};

export const BUG_RULES: Rule[] = [
  validJsonLdRule,
  validSchemaBlockRule,
  missingScopedSettingRule,
  duplicateSchemaIdRule,
  duplicateAssetLoadingRule,
  largeInlinePayloadRule,
];
