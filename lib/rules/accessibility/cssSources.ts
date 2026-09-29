import postcss from "postcss";
import type { ParsedFile } from "@/lib/theme-parser";

// Every CSS rule in the theme, from assets/*.css AND from CSS embedded in
// Liquid files ({% stylesheet %}, {% style %}, <style>). ParsedCssInfo only
// covers standalone .css files, but modern themes (Horizon-style, and the
// Aspire theme whose 2026-09-28 rejection prompted these rules) keep most
// of their component CSS inside sections/snippets — a CSS-files-only scan
// never sees the dropdown or focus styles those checks are about.
export type CssRuleSource = {
  filePath: string;
  line: number;
  selector: string;
  declarations: { prop: string; value: string; line: number }[];
};

const EMBEDDED_CSS_RE =
  /\{%-?\s*(stylesheet|style)\s*-?%\}([\s\S]*?)\{%-?\s*end(?:stylesheet|style)\s*-?%\}|<style\b[^>]*>([\s\S]*?)<\/style>/gi;

// Liquid inside CSS (`#shopify-section-{{ section.id }} .x`, `{% if %}`
// around whole rules) isn't valid CSS. Output tags become a placeholder
// identifier so selectors keep their shape; logic tags are blanked. Both
// keep their newlines so postcss line numbers still map onto the file.
function neutralizeLiquid(css: string): string {
  return css
    .replace(/\{\{[\s\S]*?\}\}/g, (m) => "liquid" + m.replace(/[^\n]/g, ""))
    .replace(/\{%[\s\S]*?%\}/g, (m) => m.replace(/[^\n]/g, " "));
}

// Native CSS nesting (`.menu { &:hover .submenu {} }`, which Horizon uses
// throughout) gives postcss a child rule whose selector is relative to its
// parent — resolve it to the full selector so selector comparisons work.
function resolveNestedSelector(rule: postcss.Rule): string {
  // Skip over at-rules (`.menu { @media (...) { &:hover {} } }`).
  let parent = rule.parent;
  while (parent && parent.type === "atrule") parent = parent.parent;
  if (!parent || parent.type !== "rule") return rule.selector;
  const parentParts = splitSelectorList(resolveNestedSelector(parent as postcss.Rule));
  const childParts = splitSelectorList(rule.selector);
  const combined: string[] = [];
  for (const p of parentParts) {
    for (const c of childParts) combined.push(c.includes("&") ? c.replace(/&/g, p) : `${p} ${c}`);
  }
  return combined.join(", ");
}

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function parseInto(out: CssRuleSource[], filePath: string, css: string, lineOffset: number) {
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return; // unparseable embedded CSS: nothing to report from it
  }
  root.walkRules((rule) => {
    const line = (rule.source?.start?.line ?? 1) + lineOffset;
    const declarations: CssRuleSource["declarations"] = [];
    rule.each((node) => {
      if (node.type === "decl") {
        declarations.push({ prop: node.prop.toLowerCase(), value: node.value, line: (node.source?.start?.line ?? 1) + lineOffset });
      }
    });
    out.push({ filePath, line, selector: resolveNestedSelector(rule), declarations });
  });
}

export function collectCssRules(files: ParsedFile[]): CssRuleSource[] {
  const out: CssRuleSource[] = [];
  for (const f of files) {
    if (f.fileType === "css") {
      parseInto(out, f.path, f.rawText, 0);
    } else if (f.fileType === "liquid") {
      for (const match of f.rawText.matchAll(EMBEDDED_CSS_RE)) {
        const body = match[2] ?? match[3] ?? "";
        const bodyStart = match.index + match[0].indexOf(body);
        parseInto(out, f.path, neutralizeLiquid(body), lineOf(f.rawText, bodyStart) - 1);
      }
    }
  }
  return out;
}

/** Split a selector list on top-level commas (not the ones inside :is()/:not()). */
export function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
