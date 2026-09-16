import type { Rule } from "@/lib/audit/rules";
import { SHOPIFY_FEATURE_RULES } from "./features";
import { SHOPIFY_SETTINGS_RULES } from "./settings";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";

const noSassRule: Rule = {
  ruleId: "SHOPIFY-CSS-NOSASS-001",
  requirementId: "SHOPIFY-CSS-001",
  category: "Theme Store Compliance",
  defaultSeverity: "high",
  title: "No Sass (.scss) files",
  description: "Themes must not use Sass or include .scss/.scss.liquid files — only native .css/.css.liquid.",
  sourceReference: "Shopify Theme Store requirements — Assets",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    return files
      .filter((f) => /\.scss(\.liquid)?$/i.test(f.path))
      .map((f) => ({
        filePath: f.path,
        category: "Theme Store Compliance" as const,
        severity: "high" as const,
        finding: "File uses the .scss extension — Theme Store submissions must use native CSS (.css/.css.liquid), not Sass.",
        recommendation: "Compile this Sass file to plain CSS before submission.",
      }));
  },
};

const noRobotsTemplateRule: Rule = {
  ruleId: "SHOPIFY-SEO-NOROBOTS-001",
  requirementId: "SHOPIFY-SEO-002",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "No robots.txt.liquid template",
  description: "Themes must not include a robots.txt.liquid template.",
  sourceReference: "Shopify Theme Store requirements — SEO",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    return files
      .filter((f) => f.path.toLowerCase().endsWith("robots.txt.liquid"))
      .map((f) => ({
        filePath: f.path,
        category: "Theme Store Compliance" as const,
        severity: "medium" as const,
        finding: "Theme includes a robots.txt.liquid template — Shopify manages robots.txt centrally and this must not be included.",
        recommendation: "Remove this file from the theme.",
      }));
  },
};

const CONTENT_FOR_HEADER_MODIFY_RE = /\{%-?\s*(?:assign|capture)\s+content_for_header\b/;
const CONTENT_FOR_HEADER_PIPE_RE = /content_for_header\s*\|/;

const contentForHeaderRule: Rule = {
  ruleId: "SHOPIFY-LIQUID-CONTENTFORHEADER-001",
  requirementId: "SHOPIFY-LIQUID-001",
  category: "Theme Store Compliance",
  defaultSeverity: "high",
  title: "content_for_header must not be modified or parsed",
  description: "Theme must not modify or parse the content_for_header object.",
  sourceReference: "Shopify Theme Store requirements — Technical",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      const lines = f.rawText.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (CONTENT_FOR_HEADER_MODIFY_RE.test(lines[i]) || CONTENT_FOR_HEADER_PIPE_RE.test(lines[i])) {
          findings.push({
            filePath: f.path,
            lineNumber: i + 1,
            category: "Theme Store Compliance" as const,
            severity: "high" as const,
            finding: "content_for_header appears to be reassigned or piped through a filter — Shopify requires this object to be output unmodified.",
            recommendation: "Output {{ content_for_header }} directly without reassigning or filtering it.",
          });
        }
      }
    }
    return findings;
  },
};

const shopifyLinksNofollowRule: Rule = {
  ruleId: "SHOPIFY-LINKS-NOFOLLOW-001",
  requirementId: "SHOPIFY-LINKS-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Links to Shopify domains must use rel=nofollow",
  description: "Any link in theme code that points to a Shopify domain must include a rel=\"nofollow\" attribute.",
  sourceReference: "Shopify Theme Store requirements — Technical",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const link of f.links) {
        if (link.href && /shopify\.com/i.test(link.href) && !(link.rel && /nofollow/i.test(link.rel))) {
          findings.push({
            filePath: f.path,
            lineNumber: link.line,
            category: "Theme Store Compliance" as const,
            severity: "medium" as const,
            finding: `Link to a Shopify domain (${link.href}) is missing rel="nofollow".`,
            recommendation: 'Add rel="nofollow" to this link.',
          });
        }
      }
    }
    return findings;
  },
};

const seoMetadataSnippetRule: Rule = {
  ruleId: "SHOPIFY-SEO-METADATA-001",
  requirementId: "SHOPIFY-SEO-001",
  category: "Theme Store Compliance",
  defaultSeverity: "high",
  title: "Theme must include the SEO metadata snippet",
  description: "Theme must contain the theme SEO metadata code snippet outputting title, meta description, and canonical URL.",
  sourceReference: "Shopify Theme Store requirements — SEO",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Theme-wide, not per-file: Phase 2 parses every file independently
  // (including rendered snippets), so a canonical/description defined in a
  // snippet the layout renders is still visible here without needing
  // Phase 4's cross-file composition graph.
  check({ files }) {
    const findings = [];
    const anchor = files.find((f) => f.path.startsWith("layout/"))?.path ?? files[0]?.path ?? "layout/theme.liquid";
    if (!files.some((f) => f.metaTags.canonical)) {
      findings.push({
        filePath: anchor,
        category: "Theme Store Compliance" as const,
        severity: "high" as const,
        finding: "No file in the theme defines a canonical link tag.",
        recommendation: 'Add <link rel="canonical" href="{{ canonical_url }}"> to the SEO metadata snippet.',
      });
    }
    if (!files.some((f) => f.metaTags.description)) {
      findings.push({
        filePath: anchor,
        category: "Theme Store Compliance" as const,
        severity: "high" as const,
        finding: "No file in the theme defines a meta description tag.",
        recommendation: 'Add <meta name="description" content="{{ page_description }}"> to the SEO metadata snippet.',
      });
    }
    return findings;
  },
};

// A small, curated dictionary of generic storefront UI strings that should
// always go through the `t` translation filter — deliberately narrow and
// exact-match only (after whitespace/case normalization), not a general
// "any English text" heuristic. This is what keeps it HIGH-confidence: a
// brand name, marketing copy, or any string outside this exact list is
// never flagged, only phrases universally recognized as generic storefront
// controls that exist in every language a store might sell in. Contextual
// in a second way too — only checked in button/link text and aria-label,
// the handful of places a hardcoded literal would visibly leak into the UI
// after a language switch, not scanned across arbitrary theme text.
const KNOWN_TRANSLATABLE_PHRASES = new Set([
  "add to cart", "sold out", "quick add", "quick view", "buy now", "buy it now",
  "checkout", "view cart", "your cart", "continue shopping", "search",
  "subscribe", "sign in", "log in", "log out", "sign out", "create account",
  "my account", "close", "menu", "next", "previous", "load more", "show more",
  "filter", "sort by", "apply", "clear all", "submit", "subtotal", "shipping",
  "quantity", "remove", "update cart", "read more", "learn more", "shop now",
  "shop all", "view all", "select options", "choose options", "share",
]);

function normalizeCandidateText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isLiquidOutput(value: string): boolean {
  return value.includes("{{") || value.includes("{%");
}

// Only an exact match against the curated list counts — a candidate that
// merely contains one of these phrases inside longer copy (e.g. "Add to
// Cart for free shipping") is deliberately left unclassified rather than
// guessed at, the same "unclassified stays unflagged" discipline the
// merchandising-axis rule uses for the same false-positive reason.
function hardcodedTextConfidence(raw: string): "high" | null {
  if (isLiquidOutput(raw)) return null;
  const normalized = normalizeCandidateText(raw);
  if (!normalized) return null;
  return KNOWN_TRANSLATABLE_PHRASES.has(normalized) ? "high" : null;
}

const hardcodedStorefrontTextRule: Rule = {
  ruleId: "SHOPIFY-LOCALE-HARDCODED-001",
  requirementId: "SHOPIFY-LOCALE-HARDCODED-TEXT-001",
  category: "Theme Store Compliance",
  defaultSeverity: "medium",
  title: "Storefront controls must be translated, not hardcoded",
  description:
    "A button/link's visible text or aria-label matching a well-known, generic storefront control (e.g. \"Add to cart\", \"Sold out\", \"Search\") should be rendered through Liquid's `t` translation filter with a locale file entry, not hardcoded literal text — otherwise it stays in one language after a customer switches store language. Matches only an exact, curated list of common controls, so a real match here is still worth a quick manual look rather than a certainty.",
  sourceReference: "Shopify Theme Store requirements — Localization",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (f.fileType !== "liquid") continue;
      for (const link of f.links) {
        if (link.text && hardcodedTextConfidence(link.text) === "high") {
          findings.push({
            filePath: f.path,
            lineNumber: link.line,
            category: "Theme Store Compliance" as const,
            severity: "medium" as const,
            finding: `<a> text "${link.text.trim()}" is a hardcoded literal for a common storefront control, not run through the \`t\` translation filter.`,
            recommendation: `Replace with {{ 'general.<key>' | t }} and add "${link.text.trim()}" to the default locale file.`,
          });
        } else if (link.ariaLabel && hardcodedTextConfidence(link.ariaLabel) === "high") {
          findings.push({
            filePath: f.path,
            lineNumber: link.line,
            category: "Theme Store Compliance" as const,
            severity: "medium" as const,
            finding: `<a> aria-label "${link.ariaLabel}" is a hardcoded literal for a common storefront control, not run through the \`t\` translation filter.`,
            recommendation: `Replace with aria-label="{{ 'general.<key>' | t }}" and add "${link.ariaLabel}" to the default locale file.`,
          });
        }
      }
      for (const button of f.buttons) {
        if (button.text && hardcodedTextConfidence(button.text) === "high") {
          findings.push({
            filePath: f.path,
            lineNumber: button.line,
            category: "Theme Store Compliance" as const,
            severity: "medium" as const,
            finding: `<button> text "${button.text.trim()}" is a hardcoded literal for a common storefront control, not run through the \`t\` translation filter.`,
            recommendation: `Replace with {{ 'general.<key>' | t }} and add "${button.text.trim()}" to the default locale file.`,
          });
        } else if (button.ariaLabel && hardcodedTextConfidence(button.ariaLabel) === "high") {
          findings.push({
            filePath: f.path,
            lineNumber: button.line,
            category: "Theme Store Compliance" as const,
            severity: "medium" as const,
            finding: `<button> aria-label "${button.ariaLabel}" is a hardcoded literal for a common storefront control, not run through the \`t\` translation filter.`,
            recommendation: `Replace with aria-label="{{ 'general.<key>' | t }}" and add "${button.ariaLabel}" to the default locale file.`,
          });
        }
      }
    }
    return findings;
  },
};

export const SHOPIFY_RULES: Rule[] = [
  noSassRule,
  noRobotsTemplateRule,
  contentForHeaderRule,
  shopifyLinksNofollowRule,
  seoMetadataSnippetRule,
  hardcodedStorefrontTextRule,
  ...SHOPIFY_FEATURE_RULES,
  ...SHOPIFY_SETTINGS_RULES,
];
