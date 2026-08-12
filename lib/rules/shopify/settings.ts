// Schema/settings-driven Theme Store checks added 2026-08-12 alongside
// features.ts — see scripts/seed-requirements.ts SHOPIFY-SETTINGS-*,
// SHOPIFY-SOCIAL-*, SHOPIFY-COLOR-SYSTEM-001, SHOPIFY-COLLECTION-002,
// SHOPIFY-BLOG-001, SHOPIFY-ARTICLE-001, SHOPIFY-PAGE-CONTACT-001,
// SHOPIFY-PASSWORD-001.
import type { ParsedFile } from "@/lib/theme-parser";
import type { Rule } from "@/lib/audit/rules";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";

// --- Shared schema traversal -----------------------------------------------
// A theme's settings live in three shapes that all need the same checks:
// a section's own "settings" array, each of its blocks' "settings" array,
// and each group in config/settings_schema.json. Collecting them once here
// avoids re-deriving this traversal in every rule below.

type SchemaSettingsContext = { filePath: string; line?: number; settings: unknown };

function collectSchemaSettingsContexts(files: ParsedFile[]): SchemaSettingsContext[] {
  const out: SchemaSettingsContext[] = [];
  for (const f of files) {
    if (f.fileType === "liquid") {
      const schema = f.schemaBlocks[0];
      if (!schema?.json) continue;
      out.push({ filePath: f.path, line: schema.line, settings: schema.json.settings });
      const blocks = Array.isArray(schema.json.blocks) ? schema.json.blocks : [];
      for (const block of blocks) {
        if (block && typeof block === "object") {
          out.push({ filePath: f.path, line: schema.line, settings: (block as Record<string, unknown>).settings });
        }
      }
    } else if (f.fileType === "json" && f.path.endsWith("config/settings_schema.json") && Array.isArray(f.jsonInfo?.json)) {
      for (const group of f.jsonInfo.json as unknown[]) {
        if (group && typeof group === "object") {
          out.push({ filePath: f.path, settings: (group as Record<string, unknown>).settings });
        }
      }
    }
  }
  return out;
}

type SchemaNameContext = { filePath: string; line?: number; name: string };

function collectSchemaNames(files: ParsedFile[]): SchemaNameContext[] {
  const out: SchemaNameContext[] = [];
  for (const f of files) {
    if (f.fileType === "liquid") {
      const schema = f.schemaBlocks[0];
      if (!schema?.json) continue;
      if (typeof schema.json.name === "string") out.push({ filePath: f.path, line: schema.line, name: schema.json.name });
      const blocks = Array.isArray(schema.json.blocks) ? schema.json.blocks : [];
      for (const block of blocks) {
        const name = block && typeof block === "object" ? (block as Record<string, unknown>).name : undefined;
        if (typeof name === "string") out.push({ filePath: f.path, line: schema.line, name });
      }
    } else if (f.fileType === "json" && f.path.endsWith("config/settings_schema.json") && Array.isArray(f.jsonInfo?.json)) {
      for (const group of f.jsonInfo.json as unknown[]) {
        const name = group && typeof group === "object" ? (group as Record<string, unknown>).name : undefined;
        if (typeof name === "string") out.push({ filePath: f.path, name });
      }
    }
  }
  return out;
}

function settingEntries(settings: unknown): Record<string, unknown>[] {
  if (!Array.isArray(settings)) return [];
  return settings.filter((s): s is Record<string, unknown> => !!s && typeof s === "object");
}

// --- Rules -------------------------------------------------------------

const noPlaceholderRule: Rule = {
  ruleId: "SHOPIFY-SETTINGS-NO-PLACEHOLDER-001",
  requirementId: "SHOPIFY-SETTINGS-NO-PLACEHOLDER-001",
  category: "Theme Store Compliance",
  defaultSeverity: "low",
  title: "Setting defaults must not use Lorem Ipsum placeholder text",
  description: "Default setting values for section/block content should show how to use the setting, never Lorem Ipsum text.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const findings = [];
    for (const ctx of collectSchemaSettingsContexts(files)) {
      for (const setting of settingEntries(ctx.settings)) {
        const def = setting.default;
        if (typeof def === "string" && /lorem ipsum/i.test(def)) {
          const id = typeof setting.id === "string" ? setting.id : "(unknown)";
          findings.push({
            filePath: ctx.filePath,
            lineNumber: ctx.line,
            category: "Theme Store Compliance" as const,
            severity: "low" as const,
            finding: `Setting "${id}" default value contains Lorem Ipsum placeholder text.`,
            recommendation: `Replace the default for "${id}" with descriptive example content showing how to use the setting.`,
          });
        }
      }
    }
    return findings;
  },
};

const NON_LABELABLE_SETTING_TYPES = new Set(["header", "paragraph"]);

const missingLabelRule: Rule = {
  ruleId: "SHOPIFY-SETTINGS-LABEL-001",
  requirementId: "SHOPIFY-SETTINGS-LABEL-001",
  category: "Theme Store Compliance",
  defaultSeverity: "low",
  title: "Every setting must have a label",
  description: "All theme settings must have a label (header/paragraph settings use \"content\" instead and are exempt).",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const findings = [];
    for (const ctx of collectSchemaSettingsContexts(files)) {
      for (const setting of settingEntries(ctx.settings)) {
        const type = typeof setting.type === "string" ? setting.type : undefined;
        if (type && NON_LABELABLE_SETTING_TYPES.has(type)) continue;
        const label = setting.label;
        if (typeof label !== "string" || label.trim() === "") {
          const id = typeof setting.id === "string" ? setting.id : "(unknown)";
          findings.push({
            filePath: ctx.filePath,
            lineNumber: ctx.line,
            category: "Theme Store Compliance" as const,
            severity: "low" as const,
            finding: `Setting "${id}" has no label.`,
            recommendation: `Add a "label" to the "${id}" setting.`,
          });
        }
      }
    }
    return findings;
  },
};

function looksLikeTitleCase(name: string): boolean {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return false;
  const allCapitalized = words.every((w) => /^[A-Z]/.test(w));
  const allUppercase = words.every((w) => w === w.toUpperCase());
  return allCapitalized && !allUppercase;
}

const sentenceCaseRule: Rule = {
  ruleId: "SHOPIFY-SETTINGS-SENTENCE-CASE-001",
  requirementId: "SHOPIFY-SETTINGS-SENTENCE-CASE-001",
  category: "Theme Store Compliance",
  defaultSeverity: "low",
  title: "Section, block, and setting-group names should use sentence case",
  description: "Section, preset, and category names should be in sentence case — only the first word and proper nouns capitalized.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // A heuristic (every word capitalized), not a certainty: a name with a
  // genuine proper noun as its second word (e.g. "Contact Shopify") would
  // also match and isn't actually wrong — worded and severity accordingly.
  check({ files }) {
    const findings = [];
    for (const ctx of collectSchemaNames(files)) {
      if (looksLikeTitleCase(ctx.name)) {
        findings.push({
          filePath: ctx.filePath,
          lineNumber: ctx.line,
          category: "Theme Store Compliance" as const,
          severity: "low" as const,
          finding: `Name "${ctx.name}" looks like Title Case — Shopify asks for sentence case (only the first word and proper nouns capitalized). Verify manually; a genuine proper noun here would be a false positive.`,
          recommendation: `Consider renaming to sentence case, e.g. "${ctx.name.charAt(0)}${ctx.name.slice(1).toLowerCase()}" if no word after the first is a proper noun.`,
        });
      }
    }
    return findings;
  },
};

function countColorSettings(settings: unknown): number {
  return settingEntries(settings).filter((s) => s.type === "color").length;
}

const colorSystemRule: Rule = {
  ruleId: "SHOPIFY-COLOR-SYSTEM-001",
  requirementId: "SHOPIFY-COLOR-SYSTEM-001",
  category: "Theme Store Compliance",
  defaultSeverity: "low",
  title: "Theme must define a minimum color system",
  description: "A minimum of 4 color-type settings are required theme-wide.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    let total = 0;
    for (const ctx of collectSchemaSettingsContexts(files)) total += countColorSettings(ctx.settings);
    // 0 usually means no settings_schema.json / schema was found at all
    // (already covered by SHOPIFY-STRUCTURE-001) rather than a genuine
    // under-count — don't double-report that as a color-system problem.
    if (total === 0 || total >= 4) return [];
    return [
      {
        filePath: "config/settings_schema.json",
        category: "Theme Store Compliance" as const,
        severity: "low" as const,
        finding: `Theme declares only ${total} color-type setting(s) theme-wide — Shopify requires a minimum of 4.`,
        recommendation: "Add more color settings (e.g. background, text, accent, border) to meet the minimum color system requirement.",
      },
    ];
  },
};

const socialOgTagsRule: Rule = {
  ruleId: "SHOPIFY-SOCIAL-OG-TAGS-001",
  requirementId: "SHOPIFY-SOCIAL-OG-TAGS-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Theme must include Open Graph and Twitter card tags",
  description: "Theme must contain Open Graph and Twitter card meta tags.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const hasOg = files.some((f) => Object.keys(f.metaTags.openGraph).length > 0);
    const hasTwitter = files.some((f) => Object.keys(f.metaTags.twitter).length > 0);
    if (hasOg && hasTwitter) return [];

    const anchor = files.find((f) => f.path.startsWith("layout/"))?.path ?? files[0]?.path ?? "layout/theme.liquid";
    const missing = [!hasOg && "Open Graph (og:*)", !hasTwitter && "Twitter card (twitter:*)"].filter(Boolean).join(" and ");
    return [
      {
        filePath: anchor,
        category: "Theme Store Compliance" as const,
        severity: "medium" as const,
        finding: `No ${missing} meta tags were found anywhere in the theme.`,
        recommendation: "Add the missing meta tags to the theme's SEO metadata snippet.",
      },
    ];
  },
};

const socialPlaceholderRule: Rule = {
  ruleId: "SHOPIFY-SOCIAL-PLACEHOLDER-001",
  requirementId: "SHOPIFY-SOCIAL-PLACEHOLDER-001",
  category: "Theme Store Compliance",
  defaultSeverity: "low",
  title: "Social media setting placeholder text must be left empty",
  description: "Social media URL setting defaults must be left empty, not pre-filled with an example URL.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const findings = [];
    for (const ctx of collectSchemaSettingsContexts(files)) {
      for (const setting of settingEntries(ctx.settings)) {
        const id = typeof setting.id === "string" ? setting.id : "";
        const def = typeof setting.default === "string" ? setting.default : "";
        if (/social.*link/i.test(id) && /^https?:\/\//i.test(def)) {
          findings.push({
            filePath: ctx.filePath,
            lineNumber: ctx.line,
            category: "Theme Store Compliance" as const,
            severity: "low" as const,
            finding: `Social media setting "${id}" has a pre-filled default URL ("${def}") — this should be left empty.`,
            recommendation: `Remove the default value for "${id}" so merchants start with an empty field.`,
          });
        }
      }
    }
    return findings;
  },
};

const collectionFieldsRule: Rule = {
  ruleId: "SHOPIFY-COLLECTION-002",
  requirementId: "SHOPIFY-COLLECTION-002",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Collection page must output collection.image and handle variable pricing",
  description: "Collection page must output collection.image, and use product.price_varies to show a price range for variably priced products.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const collectionFiles = files.filter((f) => f.fileType === "liquid" && /collection/i.test(f.path));
    if (collectionFiles.length === 0) return [];
    const anchor = collectionFiles[0].path;
    const findings = [];
    if (!collectionFiles.some((f) => /collection\.image\b/.test(f.rawText))) {
      findings.push({
        filePath: anchor,
        category: "Theme Store Compliance" as const,
        severity: "medium" as const,
        finding: "No collection-related file references collection.image.",
        recommendation: "Output collection.image on the collection page.",
      });
    }
    if (!collectionFiles.some((f) => /price_varies\b/.test(f.rawText))) {
      findings.push({
        filePath: anchor,
        category: "Theme Store Compliance" as const,
        severity: "medium" as const,
        finding: "No collection-related file references product.price_varies.",
        recommendation: "Use product.price_varies to show a price range (price_min–price_max) for products with variably priced variants.",
      });
    }
    return findings;
  },
};

const blogFieldsRule: Rule = {
  ruleId: "SHOPIFY-BLOG-001",
  requirementId: "SHOPIFY-BLOG-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Blog page must output blog.title and use article.excerpt_or_content",
  description: "Blog page must output blog.title, and each listed article must use article.excerpt_or_content rather than the full article.content.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const blogFiles = files.filter((f) => f.fileType === "liquid" && /blog/i.test(f.path));
    if (blogFiles.length === 0) return [];
    const findings = [];
    if (!blogFiles.some((f) => /blog\.title\b/.test(f.rawText))) {
      findings.push({
        filePath: blogFiles[0].path,
        category: "Theme Store Compliance" as const,
        severity: "medium" as const,
        finding: "No blog-related file references blog.title.",
        recommendation: "Output blog.title on the blog page.",
      });
    }
    for (const f of blogFiles) {
      if (/article\.content\b/.test(f.rawText) && !/excerpt_or_content\b/.test(f.rawText)) {
        findings.push({
          filePath: f.path,
          category: "Theme Store Compliance" as const,
          severity: "medium" as const,
          finding: "References article.content directly — the blog listing should use article.excerpt_or_content instead.",
          recommendation: "Replace article.content with article.excerpt_or_content in the blog listing.",
        });
      }
    }
    return findings;
  },
};

const articleFieldsRule: Rule = {
  ruleId: "SHOPIFY-ARTICLE-001",
  requirementId: "SHOPIFY-ARTICLE-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Article page must use article.published_at, not article.created_at",
  description: "Article page must output article.published_at (when the article was actually published) rather than article.created_at.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const articleFiles = files.filter((f) => f.fileType === "liquid" && /article/i.test(f.path));
    if (articleFiles.length === 0) return [];
    const findings = [];
    for (const f of articleFiles) {
      if (/article\.created_at\b/.test(f.rawText)) {
        findings.push({
          filePath: f.path,
          category: "Theme Store Compliance" as const,
          severity: "medium" as const,
          finding: "References article.created_at — Shopify requires article.published_at.",
          recommendation: "Replace article.created_at with article.published_at.",
        });
      }
    }
    if (!articleFiles.some((f) => /article\.published_at\b/.test(f.rawText))) {
      findings.push({
        filePath: articleFiles[0].path,
        category: "Theme Store Compliance" as const,
        severity: "low" as const,
        finding: "No article-related file references article.published_at.",
        recommendation: "Output article.published_at on the article page.",
      });
    }
    return findings;
  },
};

const contactPageRule: Rule = {
  ruleId: "SHOPIFY-PAGE-CONTACT-001",
  requirementId: "SHOPIFY-PAGE-CONTACT-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Page template must support a contact form alternate template",
  description: "Theme must include a templates/page.contact alternate template, outputting page.title and page.content.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const hasContactTemplate = files.some((f) => f.path.startsWith("templates/page.contact."));
    if (!hasContactTemplate) {
      return [
        {
          filePath: "templates/page.contact.json",
          category: "Theme Store Compliance" as const,
          severity: "medium" as const,
          finding: "No templates/page.contact alternate template was found.",
          recommendation: "Add templates/page.contact.json (or .liquid) rendering a contact form.",
        },
      ];
    }
    const pageFiles = files.filter((f) => f.fileType === "liquid" && /page|contact/i.test(f.path));
    const findings = [];
    if (!pageFiles.some((f) => /page\.title\b/.test(f.rawText))) {
      findings.push({
        filePath: "templates/page.contact.json",
        category: "Theme Store Compliance" as const,
        severity: "low" as const,
        finding: "No page/contact-related file references page.title.",
        recommendation: "Output page.title on the page template.",
      });
    }
    if (!pageFiles.some((f) => /page\.content\b/.test(f.rawText))) {
      findings.push({
        filePath: "templates/page.contact.json",
        category: "Theme Store Compliance" as const,
        severity: "low" as const,
        finding: "No page/contact-related file references page.content.",
        recommendation: "Output page.content on the page template.",
      });
    }
    return findings;
  },
};

const passwordPageRule: Rule = {
  ruleId: "SHOPIFY-PASSWORD-001",
  requirementId: "SHOPIFY-PASSWORD-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Password page must include shop.password_message",
  description: "Password page must include the logo or shop.name, shop.password_message, and a way to enter the storefront's password.",
  sourceReference: "Shopify Theme Store requirements",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const hasPasswordTemplate = files.some((f) => f.path.startsWith("templates/password."));
    if (!hasPasswordTemplate) {
      return [
        {
          filePath: "templates/password.json",
          category: "Theme Store Compliance" as const,
          severity: "medium" as const,
          finding: "No templates/password template was found.",
          recommendation: "Add templates/password.json (or .liquid).",
        },
      ];
    }
    const found = files.some((f) => f.fileType === "liquid" && /shop\.password_message\b/.test(f.rawText));
    if (found) return [];
    return [
      {
        filePath: "templates/password.json",
        category: "Theme Store Compliance" as const,
        severity: "medium" as const,
        finding: "No reference to shop.password_message was found anywhere in the theme.",
        recommendation: "Display shop.password_message on the password page.",
      },
    ];
  },
};

export const SHOPIFY_SETTINGS_RULES: Rule[] = [
  noPlaceholderRule,
  missingLabelRule,
  sentenceCaseRule,
  colorSystemRule,
  socialOgTagsRule,
  socialPlaceholderRule,
  collectionFieldsRule,
  blogFieldsRule,
  articleFieldsRule,
  contactPageRule,
  passwordPageRule,
];
