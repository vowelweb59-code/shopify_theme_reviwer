// Storefront design/UX checks from the Aspire theme's 2026-09-28 Theme Store
// review (ticket 69870720): the article page's excerpt option, and option
// swatches losing their images when the variant changes.
import type { Rule, RuleFinding } from "@/lib/audit/rules";
import type { ParsedFile } from "@/lib/theme-parser";
import type { ThemeIndex } from "@/lib/audit/themeIndex";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";

function stripLiquidComments(text: string): string {
  return text.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, (m) => m.replace(/[^\n]/g, " "));
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function jsonSectionTypes(template: ParsedFile): string[] {
  const sections = (template.jsonInfo?.json as Record<string, unknown> | null)?.sections;
  if (!sections || typeof sections !== "object") return [];
  return Object.values(sections as Record<string, unknown>)
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>).type : undefined))
    .filter((t): t is string => typeof t === "string");
}

/**
 * The files that render the article page itself: the sections its JSON
 * template(s) use, or a legacy templates/article*.liquid. Snippets are left
 * out on purpose — an article card snippet showing excerpts in a "related
 * articles" list is fine, only the article's own main content is in scope.
 */
function articlePageFiles(files: ParsedFile[], index: ThemeIndex): ParsedFile[] {
  const out = new Map<string, ParsedFile>();
  for (const f of files) {
    if (/^templates\/article(\.[^/]+)?\.liquid$/.test(f.path)) out.set(f.path, f);
    if (/^templates\/article(\.[^/]+)?\.json$/.test(f.path)) {
      for (const type of jsonSectionTypes(f)) {
        const section = index.sectionsByName.get(type);
        if (section) out.set(section.path, section);
      }
    }
  }
  return [...out.values()];
}

const EXCERPT_RE = /\barticle\.excerpt\b/g; // \b stops before excerpt_or_content

const articleExcerptRule: Rule = {
  ruleId: "SHOPIFY-ARTICLE-EXCERPT-001",
  requirementId: "SHOPIFY-ARTICLE-EXCERPT-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Article page should not show the article excerpt",
  description:
    "The article page already shows the full article, so a \"Show excerpt\" option that repeats article.excerpt under the title is non-essential. Theme Store reviewers ask for it to be removed (\"The article excerpt logic is non-essential. It is advisable to deprecate and remove this functionality.\"). Excerpts belong on the blog listing, via article.excerpt_or_content.",
  sourceReference: "Shopify Theme Store review feedback — Design/UX, Article page",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files, index }) {
    const findings: RuleFinding[] = [];
    for (const f of articlePageFiles(files, index)) {
      const text = stripLiquidComments(f.rawText);
      const match = EXCERPT_RE.exec(text);
      EXCERPT_RE.lastIndex = 0;
      if (!match) continue;
      const settings = (f.schemaBlocks[0]?.json?.settings ?? []) as unknown[];
      const toggle = Array.isArray(settings)
        ? settings.find((s) => s && typeof s === "object" && /excerpt/i.test(String((s as Record<string, unknown>).id ?? "")))
        : undefined;
      const toggleId = toggle ? String((toggle as Record<string, unknown>).id) : null;
      findings.push({
        filePath: f.path,
        lineNumber: lineAt(text, match.index),
        category: "Theme Store Compliance",
        severity: "medium",
        finding: `The article page outputs article.excerpt${toggleId ? ` (behind the "${toggleId}" setting)` : ""} — reviewers treat the article-page excerpt as non-essential and ask for it to be removed.`,
        recommendation: `Remove the article.excerpt output${toggleId ? ` and the "${toggleId}" setting` : ""} from the article page; keep excerpts for the blog listing only.`,
      });
    }
    return findings;
  },
};

// `value.variant` is nil when the option value can't combine with the
// other current selections — exactly the case after a variant change — so a
// swatch drawn only from the variant's image goes blank or disappears.
// Horizon's own variant-swatches.liquid documents this and falls back to
// first_available_variant; Dawn draws swatches from value.swatch instead.
const VARIANT_IMAGE_RE = /\b(\w+)\.variant\.(featured_image|featured_media|image)\b/g;
const SWATCH_FALLBACK_RE = /\.swatch\b|first_available_variant|selected_or_first_available_variant/;

const swatchImageRule: Rule = {
  ruleId: "SHOPIFY-SWATCH-STABLE-001",
  requirementId: "SHOPIFY-SWATCH-STABLE-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Option swatches must keep their image when the selected variant changes",
  description:
    "Option swatches should stay constant visual indicators. A swatch whose image comes only from the option value's variant (value.variant.featured_image) loses it when that option value has no variant for the current combination of selections, so swatches flicker or disappear on every variant change. A Theme Store rejection reason (\"Option swatches lose assigned preview images and disappear during state updates\").",
  sourceReference: "Shopify Theme Store review feedback — Design/UX, Flickering swatches",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Flags an option value's .variant image reference (directly, or through
  // an `assign x = value.variant` alias) in a file with no swatch-object or
  // first-available-variant fallback. JS that rebuilds swatch styles after a
  // re-render can cause the same flicker; that isn't detectable statically.
  check({ files }) {
    const findings: RuleFinding[] = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      const text = stripLiquidComments(f.rawText);
      if (SWATCH_FALLBACK_RE.test(text)) continue;

      const aliases = new Set<string>();
      for (const m of text.matchAll(/assign\s+(\w+)\s*=\s*(\w+)\.variant\s*(?:%\}|\n|-)/g)) {
        if (/value/i.test(m[2])) aliases.add(m[1]);
      }
      let hit: { index: number; expr: string } | null = null;
      for (const m of text.matchAll(VARIANT_IMAGE_RE)) {
        if (/value/i.test(m[1])) {
          hit = { index: m.index, expr: m[0] };
          break;
        }
      }
      if (!hit && aliases.size > 0) {
        const aliasRe = new RegExp(`\\b(${[...aliases].join("|")})\\.(featured_image|featured_media|image)\\b`);
        const m = aliasRe.exec(text);
        if (m) hit = { index: m.index, expr: m[0] };
      }
      if (!hit) continue;
      findings.push({
        filePath: f.path,
        lineNumber: lineAt(text, hit.index),
        category: "Theme Store Compliance",
        severity: "medium",
        finding: `Swatch image comes from ${hit.expr} with no fallback — that variant is nil for option values that don't combine with the current selection, so the swatch likely loses its image after a variant change.`,
        recommendation:
          "Draw the swatch from the option value's swatch object (value.swatch.image / value.swatch.color), or fall back to a variant that always exists (e.g. the first available variant with that option value) when value.variant is nil.",
      });
    }
    return findings;
  },
};

export const SHOPIFY_STOREFRONT_RULES: Rule[] = [articleExcerptRule, swatchImageRule];
