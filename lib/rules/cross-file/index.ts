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

export const CROSS_FILE_RULES: Rule[] = [
  missingSectionRule,
  missingSnippetRule,
  missingTemplateSectionRule,
  missingAssetRule,
  missingTranslationKeyRule,
  duplicateLocaleKeyRule,
  brokenAriaReferenceRule,
  missingGlobalSettingRule,
  sectionsScopeRule,
];
