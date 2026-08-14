// Phase 4 — cross-file/theme-wide checks. Unlike lib/rules/{shopify,
// accessibility,...}, these rules can't be answered by looking at one file in
// isolation — they use RuleContext.index (lib/audit/themeIndex.ts), the
// theme-wide index of what sections/snippets/assets/locale keys actually
// exist, built once per audit run.
//
// Most of these don't map to an authoritative Shopify Theme Store
// requirement (no seeded Requirement covers "broken reference"), so they're
// plain `Bug` findings rather than `Theme Store Compliance` — per phase-3's
// rule that Theme Store Compliance is reserved for rules grounded in a real
// requirement. sectionsScopeRule below is the exception: it does have a
// seeded requirement (SHOPIFY-SECTIONS-SCOPE-001) and needs the theme index
// to resolve which section a header/footer group actually renders.
import type { Rule } from "@/lib/audit/rules";
import { isExternalReference, localeKeyExists } from "@/lib/audit/themeIndex";
import { composeTemplate, composeTemplateMainContent, templateBaseName } from "@/lib/audit/templateComposition";
import { findMultipleH1Across, findSkippedHeadingLevelsAcross, type ComposedHeading } from "@/lib/audit/headingChecks";

const missingSectionRule: Rule = {
  ruleId: "REF-SECTION-MISSING-001",
  category: "Bug",
  defaultSeverity: "high",
  title: "{% section %} / {% sections %} must reference an existing section or section group",
  description:
    "A {% section 'name' %} tag must resolve to sections/name.liquid, and a {% sections 'name' %} tag must resolve to sections/name.json (a section group) — checked against every section/section-group file actually present in the theme.",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      for (const ref of f.sectionReferences) {
        if (ref.kind !== "section" || ref.dynamic) continue;
        if (index.sectionsByName.has(ref.name) || index.sectionGroupsByName.has(ref.name)) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Bug" as const,
          severity: "high" as const,
          finding: `References section "${ref.name}", but no sections/${ref.name}.liquid or sections/${ref.name}.json exists in the theme.`,
          recommendation: `Add sections/${ref.name}.liquid (or the .json section group), or fix the reference.`,
        });
      }
    }
    return findings;
  },
};

const missingSnippetRule: Rule = {
  ruleId: "REF-SNIPPET-MISSING-001",
  category: "Bug",
  defaultSeverity: "high",
  title: "{% render %} / {% include %} must reference an existing snippet",
  description:
    "A {% render 'name' %} or {% include 'name' %} tag must resolve to snippets/name.liquid, checked against every snippet file actually present in the theme.",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      for (const ref of f.sectionReferences) {
        if (ref.kind !== "snippet" || ref.dynamic) continue;
        if (index.snippetsByName.has(ref.name)) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Bug" as const,
          severity: "high" as const,
          finding: `Renders snippet "${ref.name}", but no snippets/${ref.name}.liquid exists in the theme.`,
          recommendation: `Add snippets/${ref.name}.liquid, or fix the reference.`,
        });
      }
    }
    return findings;
  },
};

const missingTemplateSectionRule: Rule = {
  ruleId: "REF-TEMPLATE-SECTION-MISSING-001",
  category: "Bug",
  defaultSeverity: "high",
  title: "JSON templates must reference an existing section type",
  description:
    "Each entry in a JSON template's \"sections\" object declares a \"type\" — that type must resolve to sections/type.liquid.",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "json" || !f.jsonInfo) continue;
      for (const ref of f.jsonInfo.sectionReferences) {
        if (index.sectionsByName.has(ref.name)) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Bug" as const,
          severity: "high" as const,
          finding: `Template references section type "${ref.name}", but no sections/${ref.name}.liquid exists in the theme.`,
          recommendation: `Add sections/${ref.name}.liquid, or fix the "type" value in this template.`,
        });
      }
    }
    return findings;
  },
};

const missingAssetRule: Rule = {
  ruleId: "REF-ASSET-MISSING-001",
  category: "Bug",
  defaultSeverity: "medium",
  title: "Referenced local asset must exist in assets/",
  description:
    "A quoted image/CSS/JS/font filename piped through asset_url (or similarly referenced) must exist in the theme's assets/ folder. External URLs are never flagged.",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      for (const ref of f.assetReferences) {
        if (isExternalReference(ref.reference)) continue;
        const name = ref.reference.startsWith("assets/") ? ref.reference.slice("assets/".length) : ref.reference;
        if (index.assetBasenames.has(name)) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Bug" as const,
          severity: "medium" as const,
          finding: `References local asset "${ref.reference}", but no matching file exists in assets/.`,
          recommendation: `Add assets/${name}, or fix the reference.`,
        });
      }
    }
    return findings;
  },
};

function jsImportCandidates(specifier: string): string[] {
  const base = specifier.split("/").pop() ?? specifier;
  return /\.[a-z0-9]+$/i.test(base) ? [base] : [base, `${base}.js`, `${base}.mjs`];
}

const missingJsImportRule: Rule = {
  ruleId: "REF-JS-IMPORT-MISSING-001",
  category: "Bug",
  defaultSeverity: "medium",
  title: "Relative JS import must resolve to a file in assets/",
  description:
    "A relative (./ or ../) JS import/require must resolve to a file actually present in assets/ — Shopify's assets/ folder is flat, so only the specifier's filename is checked. Bare specifiers (npm-style, e.g. \"alpinejs\") are never flagged — they may be resolved by a build step before upload.",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "js") continue;
      for (const imp of f.jsImports) {
        if (!imp.specifier.startsWith("./") && !imp.specifier.startsWith("../")) continue;
        const candidates = jsImportCandidates(imp.specifier);
        if (candidates.some((c) => index.assetBasenames.has(c))) continue;
        findings.push({
          filePath: f.path,
          lineNumber: imp.line,
          category: "Bug" as const,
          severity: "medium" as const,
          finding: `Imports "${imp.specifier}", but no matching file exists in assets/.`,
          recommendation: `Add assets/${candidates[0]}, or fix the import path.`,
        });
      }
    }
    return findings;
  },
};

const missingTranslationKeyRule: Rule = {
  ruleId: "REF-LOCALE-KEY-MISSING-001",
  category: "Bug",
  defaultSeverity: "medium",
  title: "Translation key must exist in the default locale file",
  description:
    "A key referenced via the `t`/`translate` filter (or direct `locale.x.y` access) must resolve to a value or pluralization group in the storefront's default locale file (locales/xx.default.json).",
  // Only runs when a default locale file was found at all — a theme with a
  // non-standard locale layout gets no findings from this rule rather than a
  // pile of false positives (phase-4 §16: unresolved, not reported as errors).
  check({ files, index }) {
    if (index.defaultLocaleTrees.length === 0) return [];
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      const seenOnLine = new Set<string>();
      for (const ref of f.localeReferences) {
        const dedupeKey = `${ref.line}:${ref.key}`;
        if (seenOnLine.has(dedupeKey)) continue;
        seenOnLine.add(dedupeKey);
        if (localeKeyExists(index, ref.key)) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Bug" as const,
          severity: "medium" as const,
          finding: `Translation key "${ref.key}" was not found in the default locale file.`,
          recommendation: `Add "${ref.key}" to locales/<default>.default.json, or fix the key.`,
        });
      }
    }
    return findings;
  },
};

const duplicateLocaleKeyRule: Rule = {
  ruleId: "REF-LOCALE-KEY-DUPLICATE-001",
  category: "Bug",
  defaultSeverity: "low",
  title: "Locale files must not contain duplicate keys",
  description: "A JSON object with a repeated key silently keeps only the last value, hiding the discarded translation.",
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "json" || !f.jsonInfo) continue;
      for (const dup of f.jsonInfo.duplicateLocaleKeys) {
        findings.push({
          filePath: f.path,
          lineNumber: dup.line,
          category: "Bug" as const,
          severity: "low" as const,
          finding: `Locale key "${dup.key}" is defined more than once in this file — only the last definition takes effect.`,
          recommendation: `Remove the duplicate "${dup.key}" entry.`,
        });
      }
    }
    return findings;
  },
};

const brokenAriaReferenceRule: Rule = {
  ruleId: "REF-ARIA-ID-MISSING-001",
  category: "Accessibility",
  defaultSeverity: "medium",
  title: "aria-labelledby / aria-describedby must reference an existing id",
  description:
    "An aria-labelledby or aria-describedby attribute must reference the id of an element that actually exists somewhere in the theme — checked theme-wide, since the target is routinely defined in a different section/snippet than the element that references it.",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      for (const ref of f.ariaReferences) {
        const missing = ref.ids.filter((id) => !index.allElementIds.has(id));
        if (missing.length === 0) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Accessibility" as const,
          severity: "medium" as const,
          finding: `${ref.attr}="${ref.ids.join(" ")}" references id${missing.length > 1 ? "s" : ""} "${missing.join('", "')}", which do${missing.length > 1 ? "" : "es"} not exist anywhere in the theme.`,
          recommendation: `Add an element with id="${missing[0]}", or fix the ${ref.attr} value.`,
        });
      }
    }
    return findings;
  },
};

const missingGlobalSettingRule: Rule = {
  ruleId: "REF-SETTINGS-GLOBAL-MISSING-001",
  category: "Bug",
  defaultSeverity: "medium",
  title: "settings.x must reference a declared global theme setting",
  description:
    "A bare settings.x reference (as opposed to section.settings.x or block.settings.x) must resolve to an id declared in config/settings_schema.json.",
  // Skipped entirely if no settings_schema.json was found/parsed — a theme
  // with a non-standard config layout gets no findings here rather than a
  // false positive on every settings.x reference in the theme.
  check({ files, index }) {
    if (index.globalSettingIds.size === 0) return [];
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      for (const ref of f.settingReferences) {
        if (ref.scope !== "global" || index.globalSettingIds.has(ref.key)) continue;
        findings.push({
          filePath: f.path,
          lineNumber: ref.line,
          category: "Bug" as const,
          severity: "medium" as const,
          finding: `References global setting "settings.${ref.key}", but no setting with that id is declared in config/settings_schema.json.`,
          recommendation: `Add a setting with id "${ref.key}" to config/settings_schema.json, or fix the reference.`,
        });
      }
    }
    return findings;
  },
};

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";

const sectionsScopeRule: Rule = {
  ruleId: "SHOPIFY-SECTIONS-SCOPE-001",
  requirementId: "SHOPIFY-SECTIONS-SCOPE-001",
  category: "Theme Store Compliance",
  defaultSeverity: "low",
  title: "Sections in header/footer groups should be scoped with enabled_on/disabled_on",
  description:
    "It's recommended to use the enabled_on/disabled_on schema attributes to restrict a section's availability to relevant contexts — general-purpose sections included in the Header/Footer groups should declare this scope.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Recommendation-level per Shopify's own wording ("it's recommended"), not
  // a hard "must" — kept at low severity, and only checked for section
  // groups whose path suggests header/footer to avoid guessing at every
  // section group in the theme.
  check({ files, index }) {
    const findings = [];
    const groupFiles = files.filter(
      (f) => f.fileType === "json" && f.path.startsWith("sections/") && /(header|footer)/i.test(f.path)
    );
    for (const group of groupFiles) {
      if (!group.jsonInfo) continue;
      for (const ref of group.jsonInfo.sectionReferences) {
        const section = index.sectionsByName.get(ref.name);
        if (!section) continue; // missing section is REF-TEMPLATE-SECTION-MISSING-001's job
        const schema = section.schemaBlocks[0];
        if (!schema?.json) continue;
        const hasScope = "enabled_on" in schema.json || "disabled_on" in schema.json;
        if (hasScope) continue;
        findings.push({
          filePath: group.path,
          lineNumber: ref.line,
          category: "Theme Store Compliance" as const,
          severity: "low" as const,
          finding: `Section "${ref.name}" is included in ${group.path} (a header/footer group) but its own schema declares no enabled_on/disabled_on scope.`,
          recommendation: `Add enabled_on/disabled_on to sections/${ref.name}.liquid's schema to restrict it to appropriate template contexts, or confirm it's intentionally general-purpose.`,
        });
      }
    }
    return findings;
  },
};

// --- Template-level SEO composition (phase-4 §6) ------------------------
// Statically composes each JSON template into itself + its rendered
// sections + those sections' rendered snippets (templateComposition.ts),
// then re-runs the heading checks across that combined set. These are the
// cross-file complements to technical-seo's per-file SEO-H1-MULTIPLE-001 /
// SEO-HEADING-SKIP-001, which can only ever see one file at a time.

const TEMPLATES_REQUIRING_H1 = new Set(["index", "collection", "product", "page", "blog", "article", "list-collections", "search"]);

function composedHeadingEntries(files: ReturnType<typeof composeTemplateMainContent>["files"]): ComposedHeading[] {
  return files.flatMap((f) => f.headings.map((heading) => ({ filePath: f.path, heading })));
}

const composedH1MissingRule: Rule = {
  ruleId: "SEO-H1-MISSING-COMPOSED-001",
  requirementId: "TECH-SEO-H1-001",
  category: "Technical SEO",
  defaultSeverity: "medium",
  title: "Each rendered page/template should have an H1 (composed)",
  description:
    "Each rendered page/template should have exactly one H1 identifying the page's main topic — checked across the template's statically composed sections and snippets, not just one file.",
  sourceReference: "General technical SEO best practice",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "json" || !f.path.startsWith("templates/")) continue;
      if (!TEMPLATES_REQUIRING_H1.has(templateBaseName(f.path))) continue;

      const composed = composeTemplateMainContent(f, index);
      const totalH1 = composed.files.reduce((sum, cf) => sum + cf.headings.filter((h) => h.level === 1).length, 0);
      if (totalH1 === 0) {
        findings.push({
          filePath: f.path,
          category: "Technical SEO" as const,
          severity: "medium" as const,
          finding: `No <h1> was found anywhere in ${f.path}'s statically composed sections/snippets.`,
          recommendation: "Ensure one of the sections this template renders outputs an <h1>.",
        });
      }
    }
    return findings;
  },
};

const composedMultipleH1Rule: Rule = {
  ruleId: "SEO-H1-MULTIPLE-COMPOSED-001",
  requirementId: "TECH-SEO-H1-001",
  category: "Technical SEO",
  defaultSeverity: "medium",
  title: "No more than one H1 across a composed template",
  description: "A template's statically composed sections/snippets should not collectively output more than one <h1>.",
  sourceReference: "General technical SEO best practice",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "json" || !f.path.startsWith("templates/")) continue;
      const composed = composeTemplateMainContent(f, index);
      for (const issue of findMultipleH1Across(composedHeadingEntries(composed.files))) {
        findings.push({
          filePath: issue.filePath,
          lineNumber: issue.line,
          category: "Technical SEO" as const,
          severity: "medium" as const,
          finding: `${f.path}: ${issue.message}`,
          recommendation: "Ensure only one section in this template outputs an <h1>; use lower heading levels elsewhere.",
        });
      }
    }
    return findings;
  },
};

const composedSkippedHeadingRule: Rule = {
  ruleId: "SEO-HEADING-SKIP-COMPOSED-001",
  requirementId: "TECH-SEO-HEADING-001",
  category: "Technical SEO",
  defaultSeverity: "low",
  title: "No skipped heading levels across a composed template",
  description:
    "Heading hierarchy should not skip levels across a template's statically composed sections/snippets (e.g. one section's h2 followed by another's h4).",
  sourceReference: "General technical SEO best practice",
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "json" || !f.path.startsWith("templates/")) continue;
      const composed = composeTemplateMainContent(f, index);
      for (const issue of findSkippedHeadingLevelsAcross(composedHeadingEntries(composed.files))) {
        findings.push({
          filePath: issue.filePath,
          lineNumber: issue.line,
          category: "Technical SEO" as const,
          severity: "low" as const,
          finding: `${f.path}: ${issue.message}`,
          recommendation: "Use heading levels in sequence across the sections this template renders.",
        });
      }
    }
    return findings;
  },
};

// --- Template-level structured-data mapping (phase-4 §7) -----------------
// Connects JSON-LD to the specific template that's supposed to render it,
// rather than the theme-wide "does this exist anywhere" checks in
// lib/rules/technical-aeo. Deliberately does NOT re-report "no Product/
// Article JSON-LD anywhere in the theme" — that stays AEO-PRODUCT-SCHEMA-001
// / AEO-ARTICLE-SCHEMA-001's job. These add the two things only composition
// can reveal: schema that exists somewhere in the theme but isn't actually
// reachable from the template that needs it, and duplicate schema within
// one template's composed output.

const GOOGLE_PRODUCT_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/product";
const GOOGLE_ARTICLE_SD_URL = "https://developers.google.com/search/docs/appearance/structured-data/article";

function countJsonLdType(files: { jsonLdBlocks: { types: string[] }[] }[], type: string): number {
  return files.reduce((sum, f) => sum + f.jsonLdBlocks.filter((b) => b.types.includes(type)).length, 0);
}

// Shopify's `| structured_data` filter (e.g. `{{ product | structured_data }}`,
// used by Dawn's own main-product.liquid/main-article.liquid) generates the
// entire JSON-LD <script> server-side — literal-markup counting above can
// never see it, so it's counted separately here and added in.
function countStructuredDataFilterUsage(files: { rawText: string }[], objectName: string): number {
  const re = new RegExp(`\\b${objectName}\\s*\\|\\s*structured_data\\b`, "g");
  return files.reduce((sum, f) => sum + (f.rawText.match(re)?.length ?? 0), 0);
}

function composedSchemaRule(config: {
  ruleId: string;
  requirementId: string;
  jsonLdType: string;
  objectName: string;
  templateBase: string;
  title: string;
  sourceUrl: string;
}): Rule {
  return {
    ruleId: config.ruleId,
    requirementId: config.requirementId,
    category: "Technical AEO",
    defaultSeverity: "high",
    title: config.title,
    description: `A ${config.jsonLdType} JSON-LD block that exists elsewhere in the theme but isn't rendered by the actual ${config.templateBase} template doesn't help that page, and rendering more than one is duplicate structured data.`,
    sourceReference: `Google: ${config.jsonLdType} structured data`,
    sourceUrl: config.sourceUrl,
    check({ files, index }) {
      const findings = [];
      const themeWideCount = countJsonLdType(files, config.jsonLdType) + countStructuredDataFilterUsage(files, config.objectName);
      if (themeWideCount === 0) return [];

      for (const f of files) {
        if (f.fileType !== "json" || !f.path.startsWith("templates/") || templateBaseName(f.path) !== config.templateBase) continue;
        const composed = composeTemplate(f, index);
        const composedCount =
          countJsonLdType(composed.files, config.jsonLdType) + countStructuredDataFilterUsage(composed.files, config.objectName);

        if (composedCount === 0) {
          findings.push({
            filePath: f.path,
            category: "Technical AEO" as const,
            severity: "high" as const,
            finding: `${config.jsonLdType} JSON-LD exists elsewhere in the theme, but none is reachable from ${f.path}'s own composed sections/snippets.`,
            recommendation: `Move (or add) the ${config.jsonLdType} JSON-LD block to a section this template actually renders.`,
          });
        } else if (composedCount > 1) {
          findings.push({
            filePath: f.path,
            category: "Technical AEO" as const,
            severity: "medium" as const,
            finding: `${composedCount} separate ${config.jsonLdType} JSON-LD blocks are reachable from ${f.path} — duplicate structured data can confuse search engines.`,
            recommendation: `Ensure only one section renders ${config.jsonLdType} JSON-LD for this template.`,
          });
        }
      }
      return findings;
    },
  };
}

const composedProductSchemaRule = composedSchemaRule({
  ruleId: "AEO-PRODUCT-SCHEMA-COMPOSED-001",
  requirementId: "TECH-AEO-PRODUCT-001",
  jsonLdType: "Product",
  objectName: "product",
  templateBase: "product",
  title: "Product JSON-LD should be reachable from the product template, not just present in the theme",
  sourceUrl: GOOGLE_PRODUCT_SD_URL,
});

const composedArticleSchemaRule = composedSchemaRule({
  ruleId: "AEO-ARTICLE-SCHEMA-COMPOSED-001",
  requirementId: "TECH-AEO-ARTICLE-001",
  jsonLdType: "Article",
  objectName: "article",
  templateBase: "article",
  title: "Article JSON-LD should be reachable from the article template, not just present in the theme",
  sourceUrl: GOOGLE_ARTICLE_SD_URL,
});

export const CROSS_FILE_RULES: Rule[] = [
  missingSectionRule,
  missingSnippetRule,
  missingTemplateSectionRule,
  missingAssetRule,
  missingJsImportRule,
  missingTranslationKeyRule,
  duplicateLocaleKeyRule,
  brokenAriaReferenceRule,
  missingGlobalSettingRule,
  sectionsScopeRule,
  composedH1MissingRule,
  composedMultipleH1Rule,
  composedSkippedHeadingRule,
  composedProductSchemaRule,
  composedArticleSchemaRule,
];
