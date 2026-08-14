import type { Rule } from "@/lib/audit/rules";
import { contrastRatio, parseColorToRgb } from "@/lib/audit/colorContrast";
import { findSkippedHeadingLevels } from "@/lib/audit/headingChecks";

const THEME_STORE_REQUIREMENTS_URL = "https://shopify.dev/docs/storefronts/themes/store/requirements";
const ACCESSIBILITY_BEST_PRACTICES_URL = "https://shopify.dev/docs/storefronts/themes/best-practices/accessibility";

const htmlLangRule: Rule = {
  ruleId: "SHOPIFY-A11Y-LANG-001",
  requirementId: "SHOPIFY-A11Y-001",
  category: "Accessibility",
  defaultSeverity: "blocker",
  title: "html element must specify a lang attribute",
  description: "The <html> element must specify a `lang` attribute, populated from `request.locale`.",
  sourceReference: "Shopify Theme Store requirements — Accessibility",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Only layout/*.liquid files actually render an <html> element.
  check({ files }) {
    return files
      .filter((f) => f.path.startsWith("layout/") && f.fileType === "liquid")
      .filter((f) => !f.metaTags.htmlLang)
      .map((f) => ({
        filePath: f.path,
        category: "Accessibility" as const,
        severity: "blocker" as const,
        finding: "The <html> element in this layout is missing a lang attribute.",
        recommendation: 'Add lang="{{ request.locale.iso_code }}" to the <html> element.',
      }));
  },
};

const NON_LABELABLE_INPUT_TYPES = new Set(["hidden", "submit", "button", "image"]);

const formLabelRule: Rule = {
  ruleId: "SHOPIFY-A11Y-LABEL-001",
  requirementId: "SHOPIFY-A11Y-002",
  category: "Accessibility",
  defaultSeverity: "high",
  title: "Form inputs must have an associated label",
  description: "Form inputs must have a unique ID, with associated labels using a `for` attribute matching that ID.",
  sourceReference: "Shopify Theme Store requirements — Accessibility",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Checked theme-wide (index.labelForTargets), not per-file: a component's
  // <label> and its <input> are routinely split across a section and the
  // snippet it renders — phase-4 §12 explicitly warns against treating that
  // split as a missing relationship.
  check({ files, index }) {
    const findings = [];
    for (const f of files) {
      for (const input of f.inputs) {
        if (input.type && NON_LABELABLE_INPUT_TYPES.has(input.type)) continue;
        const hasAccessibleName = (input.id && index.labelForTargets.has(input.id)) || input.ariaLabel || input.ariaLabelledBy;
        if (!hasAccessibleName) {
          findings.push({
            filePath: f.path,
            lineNumber: input.line,
            category: "Accessibility" as const,
            severity: "high" as const,
            finding: `A ${input.tag}${input.name ? ` named "${input.name}"` : ""} has no associated <label>, aria-label, or aria-labelledby.`,
            recommendation: input.id
              ? `Add a <label for="${input.id}"> for this field, or an aria-label.`
              : "Give this field an id and a matching <label for>, or an aria-label.",
          });
        }
      }
    }
    return findings;
  },
};

const missingAltRule: Rule = {
  ruleId: "A11Y-IMG-ALT-001",
  requirementId: "A11Y-BP-001",
  category: "Accessibility",
  defaultSeverity: "high",
  title: "Images must have an alt attribute",
  description: "All <img> elements must have an alt attribute. Decorative images should use an empty alt (\"\") rather than omitting the attribute.",
  sourceReference: "Accessibility best practices for Shopify themes",
  sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const img of f.images) {
        if (img.altSource === "missing") {
          findings.push({
            filePath: f.path,
            lineNumber: img.line,
            category: "Accessibility" as const,
            severity: "high" as const,
            finding: `<${img.tag}> has no alt attribute at all${img.src ? ` (src: ${img.src})` : ""}.`,
            recommendation: 'Add a descriptive alt attribute, or alt="" if the image is purely decorative.',
          });
        }
      }
    }
    return findings;
  },
};

const focusOrderRule: Rule = {
  ruleId: "A11Y-TABINDEX-001",
  requirementId: "A11Y-BP-004",
  category: "Accessibility",
  defaultSeverity: "medium",
  title: "No positive tabindex or autofocus",
  description: "Theme should avoid positive tabindex values and the autofocus attribute, which override the natural, organic focus order.",
  sourceReference: "Accessibility best practices for Shopify themes",
  sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const el of f.interactiveElements) {
        if (el.tabIndex !== null && el.tabIndex > 0) {
          findings.push({
            filePath: f.path,
            lineNumber: el.line,
            category: "Accessibility" as const,
            severity: "medium" as const,
            finding: `<${el.tag}> uses tabindex="${el.tabIndex}", a positive value that overrides natural focus order.`,
            recommendation: 'Use tabindex="0" (or remove it) instead of a positive value.',
          });
        }
      }
      if (f.fileType === "liquid") {
        const lines = f.rawText.split("\n");
        for (let i = 0; i < lines.length; i++) {
          // tabindex="-1" alongside autofocus is the standard idiom for
          // shifting focus to a dynamic status message (e.g. a form's
          // success/error heading) rather than the page-load focus-theft
          // anti-pattern this rule targets — found auditing a real theme
          // (Splash) using exactly this pattern on <h2 tabindex="-1"
          // autofocus> form status messages. A normally-focusable control
          // (an <input>) would never carry tabindex="-1" alongside
          // autofocus, since that would remove it from the tab order.
          if (/\bautofocus\b/i.test(lines[i]) && !/tabindex\s*=\s*["']-1["']/i.test(lines[i])) {
            findings.push({
              filePath: f.path,
              lineNumber: i + 1,
              category: "Accessibility" as const,
              severity: "medium" as const,
              finding: "Element uses the autofocus attribute, which forces focus and can disorient keyboard/screen-reader users.",
              recommendation: "Remove autofocus and let the user control initial focus.",
            });
          }
        }
      }
    }
    return findings;
  },
};

const skippedHeadingA11yRule: Rule = {
  ruleId: "A11Y-HEADING-SKIP-001",
  requirementId: "A11Y-BP-005",
  category: "Accessibility",
  defaultSeverity: "medium",
  title: "Heading levels should not skip",
  description: "Heading tags (h1-h6) should be used in sequence to convey the logical structure of content, not chosen for visual styling.",
  sourceReference: "Accessibility best practices for Shopify themes",
  sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const issue of findSkippedHeadingLevels(f)) {
        findings.push({
          filePath: f.path,
          lineNumber: issue.line,
          category: "Accessibility" as const,
          severity: "medium" as const,
          finding: issue.message,
          recommendation: "Use heading levels in sequence rather than skipping for visual effect.",
        });
      }
    }
    return findings;
  },
};

const COLOR_LIKE_PROPS = new Set(["color"]);
const BG_LIKE_PROPS = new Set(["background-color", "background"]);

const colorContrastRule: Rule = {
  ruleId: "A11Y-CONTRAST-001",
  requirementId: "SHOPIFY-A11Y-004",
  category: "Accessibility",
  defaultSeverity: "high",
  title: "Text color contrast must meet WCAG AA",
  description:
    "Text color contrast ratio must be at least 4.5:1 for main body content, and 3:1 for larger text and non-text elements.",
  sourceReference: "Shopify Theme Store requirements — Accessibility",
  sourceUrl: THEME_STORE_REQUIREMENTS_URL,
  // Limited to declarations resolvable to concrete sRGB values (hex/rgb) on
  // an exactly-matching selector within the same file — var()-based themes
  // (most real themes) are correctly left as indeterminate rather than
  // guessing, per the doc's explicit caution on this.
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (!f.cssInfo) continue;
      const bySelector = new Map<string, { color?: { line: number; value: string }; bg?: { line: number; value: string } }>();
      for (const decl of f.cssInfo.colorDeclarations) {
        const entry = bySelector.get(decl.selector) ?? {};
        if (COLOR_LIKE_PROPS.has(decl.property)) entry.color = { line: decl.line, value: decl.value };
        else if (BG_LIKE_PROPS.has(decl.property)) entry.bg = { line: decl.line, value: decl.value };
        bySelector.set(decl.selector, entry);
      }
      for (const [selector, pair] of bySelector) {
        if (!pair.color || !pair.bg) continue;
        const fg = parseColorToRgb(pair.color.value);
        const bg = parseColorToRgb(pair.bg.value);
        if (!fg || !bg) continue;
        const ratio = contrastRatio(fg, bg);
        if (ratio < 4.5) {
          findings.push({
            filePath: f.path,
            lineNumber: pair.color.line,
            category: "Accessibility" as const,
            severity: "high" as const,
            finding: `Selector "${selector}" has a contrast ratio of ${ratio.toFixed(2)}:1 (color: ${pair.color.value}, background: ${pair.bg.value}) — below the WCAG AA minimum of 4.5:1 for normal text.`,
            recommendation: "Increase the contrast between the text color and background color for this selector.",
          });
        }
      }
    }
    return findings;
  },
};

function stripFocusPseudo(selector: string): string {
  return selector.replace(/:focus-visible\b/gi, "").replace(/:focus\b/gi, "").trim();
}

function selectorParts(selector: string): string[] {
  return selector.split(",").map((s) => s.trim()).filter(Boolean);
}

// postcss's rule.selector preserves the source's original line breaks for
// a multi-line compound selector (one per comma-separated part, as many
// real stylesheets format them) — fine for matching, but dumped raw into a
// finding message it reads as a garbled multi-line blob. Collapse to one
// line for display only (found auditing Shopify's own Dawn theme).
function formatSelectorForDisplay(selector: string): string {
  return selector.replace(/\s+/g, " ").trim();
}

const outlineRemovalRule: Rule = {
  ruleId: "A11Y-OUTLINE-REMOVAL-001",
  requirementId: "A11Y-BP-008",
  category: "Accessibility",
  defaultSeverity: "medium",
  title: "outline: none must have a visible focus replacement",
  description:
    "A selector that removes the outline (outline: none/0) must have a :focus or :focus-visible rule for the same selector providing a visible replacement.",
  sourceReference: "Accessibility best practices for Shopify themes",
  sourceUrl: ACCESSIBILITY_BEST_PRACTICES_URL,
  // Matches by comparing the outline-removal selector against every
  // :focus/:focus-visible selector in the same file with its pseudo-class
  // stripped — e.g. ".btn:focus" becomes ".btn", matched against a plain
  // ".btn { outline: none }" rule. Compound (comma-separated) selectors are
  // split on both sides. This can't see a replacement style defined via a
  // different but equivalent selector (e.g. a shared class applied via
  // Liquid), so it's a heuristic, not a certainty.
  check({ files }) {
    const findings = [];
    for (const f of files) {
      if (!f.cssInfo) continue;
      const focusBases = new Set<string>();
      for (const rule of [...f.cssInfo.focusRules, ...f.cssInfo.focusVisibleRules]) {
        for (const part of selectorParts(rule.selector)) focusBases.add(stripFocusPseudo(part));
      }
      for (const removal of f.cssInfo.outlineRemovals) {
        // The removal's own selector may itself be a :focus/:focus-visible
        // rule (e.g. ".btn:focus { outline: none }") — strip it the same
        // way focusBases was built, or a separate :focus-visible providing
        // the real replacement would never match.
        const removalBases = selectorParts(removal.selector).map(stripFocusPseudo);
        const hasReplacement = removalBases.some((base) => focusBases.has(base));
        if (hasReplacement) continue;
        const displaySelector = formatSelectorForDisplay(removal.selector);
        findings.push({
          filePath: f.path,
          lineNumber: removal.line,
          category: "Accessibility" as const,
          severity: "medium" as const,
          finding: `Selector "${displaySelector}" removes the outline with no corresponding :focus/:focus-visible rule found in this file.`,
          recommendation: `Add a :focus or :focus-visible style for "${displaySelector}" so keyboard users still see where focus is.`,
        });
      }
    }
    return findings;
  },
};

export const ACCESSIBILITY_RULES: Rule[] = [
  htmlLangRule,
  formLabelRule,
  missingAltRule,
  focusOrderRule,
  skippedHeadingA11yRule,
  colorContrastRule,
  outlineRemovalRule,
];
