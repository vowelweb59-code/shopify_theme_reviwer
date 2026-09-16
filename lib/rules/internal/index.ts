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

// A small, curated keyword taxonomy of common merchandising "jobs" a
// collection/product section organizes around — deliberately not full
// content understanding (no AI/LLM call, per this project's core
// architectural rule), just a bounded lookup. Anything outside these
// keywords is left unclassified rather than guessed at: e.g. "shop by
// brand" and "shop by age" correctly never match each other (different
// axes), while "New Arrivals" and "Trending Now" both land on
// recency/popularity (the actual repetitive case this rule targets) even
// though their literal text differs completely.
const MERCHANDISING_AXES: { axis: string; keywords: string[] }[] = [
  { axis: "recency/popularity", keywords: ["new", "arrival", "latest", "trending", "hot", "popular", "bestseller", "best seller", "top seller", "just in", "fresh"] },
  { axis: "brand", keywords: ["brand", "designer", "label"] },
  { axis: "demographic", keywords: ["men", "women", "kids", "kid", "baby", "teen", "unisex", "boys", "girls", "age"] },
  { axis: "price/value", keywords: ["sale", "clearance", "deal", "discount", "budget", "offer"] },
  { axis: "occasion/season", keywords: ["holiday", "christmas", "summer", "winter", "spring", "fall", "gift", "wedding", "birthday"] },
];

function classifyMerchandisingAxis(topic: string): string | null {
  const normalized = topic.toLowerCase();
  for (const { axis, keywords } of MERCHANDISING_AXES) {
    if (keywords.some((kw) => normalized.includes(kw))) return axis;
  }
  return null;
}

// Only the section-level settings most likely to name what a section is
// actually organizing around — not a full recursive walk of blocks/nested
// settings, a deliberately bounded scope.
const TOPIC_SETTING_KEYS = ["heading", "title", "subheading", "collection", "collection_list"];

function settingTextValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function sectionTopicText(settings: unknown, index: Parameters<Rule["check"]>[0]["index"]): string {
  if (!settings || typeof settings !== "object") return "";
  const parts: string[] = [];
  for (const key of TOPIC_SETTING_KEYS) {
    for (const raw of settingTextValues((settings as Record<string, unknown>)[key])) {
      const resolved = resolveSchemaString(index, raw) ?? raw;
      parts.push(resolved.replace(/[-_]/g, " "));
    }
  }
  return parts.join(" ");
}

// Deliberately narrow to section types whose whole purpose is organizing a
// set of products/collections — the kind of section the "distinct customer
// job" requirement is actually about, not every section on the page.
const MERCHANDISING_SECTION_TYPE_RE = /collection|featured-product|product-list|product-recommendations/i;

type TemplateSection = { type?: unknown; settings?: unknown };
type TemplateJson = { sections?: Record<string, TemplateSection> };

const repetitiveSectionAxisRule: Rule = {
  ruleId: "INTERNAL-SECTION-AXIS-DUPLICATE-001",
  requirementId: "INTERNAL-DESIGN-SECTION-PURPOSE-001",
  category: "Internal Standard",
  defaultSeverity: "low",
  title: "Multiple sections of the same type may serve the same merchandising job",
  description:
    "Two or more sections of the same type on one template, whose heading/collection text both match the same known merchandising axis (e.g. both organize by recency/popularity — 'New Arrivals' and 'Trending Now' — despite completely different wording), likely present the same underlying browsing job with a different skin. Matches against a small curated keyword list, not full content understanding — a section whose text doesn't match any known axis is never flagged either way (e.g. 'shop by brand' vs. 'shop by age' correctly stay unflagged, since they land on different axes), and a real match here is still worth a manual look, not a certainty.",
  sourceReference: "Internal design-review standard (originality audit framework)",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "json" || !f.path.startsWith("templates/")) continue;
      if (!f.jsonInfo?.json || typeof f.jsonInfo.json !== "object") continue;
      const template = f.jsonInfo.json as TemplateJson;
      if (!template.sections || typeof template.sections !== "object") continue;

      const byType = new Map<string, { key: string; axis: string }[]>();
      for (const [key, section] of Object.entries(template.sections)) {
        const type = section?.type;
        if (typeof type !== "string" || !MERCHANDISING_SECTION_TYPE_RE.test(type)) continue;
        const axis = classifyMerchandisingAxis(sectionTopicText(section.settings, index));
        if (!axis) continue;
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push({ key, axis });
      }

      for (const [type, entries] of byType) {
        const byAxis = new Map<string, string[]>();
        for (const { key, axis } of entries) {
          if (!byAxis.has(axis)) byAxis.set(axis, []);
          byAxis.get(axis)!.push(key);
        }
        for (const [axis, keys] of byAxis) {
          if (keys.length < 2) continue;
          findings.push({
            filePath: f.path,
            category: "Internal Standard" as const,
            severity: "low" as const,
            finding: `Sections "${keys.join('", "')}" (type "${type}") all appear to organize products by ${axis} — likely the same underlying browsing job with a different skin. Verify manually: this only recognizes a small set of known merchandising axes from heading/collection text, not full content understanding.`,
            recommendation: "Consider consolidating these sections, or differentiate one to serve a genuinely different customer job (e.g. browse by brand, by occasion, or a personalized finder).",
          });
        }
      }
    }
    return findings;
  },
};

export const INTERNAL_RULES: Rule[] = [headingMatchesSectionNameRule, repetitiveSectionAxisRule];
