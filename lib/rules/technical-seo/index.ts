import type { Rule } from "@/lib/audit/rules";
import { findMultipleH1, findSkippedHeadingLevels } from "@/lib/audit/headingChecks";

const skippedHeadingSeoRule: Rule = {
  ruleId: "SEO-HEADING-SKIP-001",
  requirementId: "TECH-SEO-HEADING-001",
  category: "Technical SEO",
  defaultSeverity: "low",
  title: "Heading hierarchy should not skip levels",
  description: "Heading hierarchy should not skip levels (e.g. an h2 followed directly by an h4 with no h3).",
  sourceReference: "General technical SEO best practice",
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const issue of findSkippedHeadingLevels(f)) {
        findings.push({
          filePath: f.path,
          lineNumber: issue.line,
          category: "Technical SEO" as const,
          severity: "low" as const,
          finding: issue.message,
          recommendation: "Use heading levels in sequence for a coherent document outline.",
        });
      }
    }
    return findings;
  },
};

const multipleH1Rule: Rule = {
  ruleId: "SEO-H1-MULTIPLE-001",
  requirementId: "TECH-SEO-H1-001",
  category: "Technical SEO",
  defaultSeverity: "medium",
  title: "No more than one H1 per file",
  description: "Each rendered page/template should have exactly one H1 element identifying the page's main topic.",
  sourceReference: "General technical SEO best practice",
  // Scoped to "more than one H1 within a single file" only — a section
  // legitimately having zero H1s (because the page's H1 lives in a
  // different composing section) is not checkable without Phase 4's
  // template-composition analysis, so that half of the requirement is
  // deliberately not implemented here.
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const issue of findMultipleH1(f)) {
        findings.push({
          filePath: f.path,
          lineNumber: issue.line,
          category: "Technical SEO" as const,
          severity: "medium" as const,
          finding: issue.message,
          recommendation: "Use only one <h1> per file; use lower heading levels for secondary titles.",
        });
      }
    }
    return findings;
  },
};

const imageDimensionsRule: Rule = {
  ruleId: "SEO-IMG-DIMENSIONS-001",
  requirementId: "TECH-SEO-IMG-001",
  category: "Technical SEO",
  defaultSeverity: "medium",
  title: "Images should declare explicit width/height",
  description: "Images should declare explicit width/height (or aspect-ratio) to prevent layout shift.",
  sourceReference: "General technical SEO best practice",
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const img of f.images) {
        if (img.isLikelyDecorative) continue;
        if (!img.hasWidth || !img.hasHeight) {
          findings.push({
            filePath: f.path,
            lineNumber: img.line,
            category: "Technical SEO" as const,
            severity: "medium" as const,
            finding: `<${img.tag}> is missing ${!img.hasWidth && !img.hasHeight ? "width and height" : !img.hasWidth ? "width" : "height"} attributes, risking layout shift.`,
            recommendation: "Add explicit width and height attributes (or CSS aspect-ratio) matching the image's intrinsic size.",
          });
        }
      }
    }
    return findings;
  },
};

const renderBlockingScriptRule: Rule = {
  ruleId: "SEO-SCRIPT-RENDERBLOCKING-001",
  requirementId: "TECH-PERF-SCRIPT-001",
  category: "Technical SEO",
  defaultSeverity: "medium",
  title: "Scripts in <head> should not render-block",
  description: "A <script src=...> placed in <head> should use async or defer rather than blocking HTML parsing.",
  sourceReference: "General technical performance best practice",
  // "location: head" only reflects <head>...<script>...</head> found
  // structurally within this one file (Phase 2 parses files independently),
  // so this reliably catches layout/theme.liquid but can't see a script
  // injected into <head> from a rendered snippet.
  check({ files }) {
    const findings = [];
    for (const f of files) {
      for (const script of f.scripts) {
        if (script.location === "head" && !script.inline && script.src && !script.async && !script.defer) {
          findings.push({
            filePath: f.path,
            lineNumber: script.line,
            category: "Technical SEO" as const,
            severity: "medium" as const,
            finding: `<script src="${script.src}"> in <head> has neither async nor defer, blocking HTML parsing.`,
            recommendation: "Add defer (or async if execution order doesn't matter), or move the script tag to just before </body>.",
          });
        }
      }
    }
    return findings;
  },
};

export const TECHNICAL_SEO_RULES: Rule[] = [skippedHeadingSeoRule, multipleH1Rule, imageDimensionsRule, renderBlockingScriptRule];
