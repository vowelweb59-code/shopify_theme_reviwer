import postcss from "postcss";
import { looksLikeColorValue } from "./cssColorNames";
import type { ParsedCssInfo, ParsedParseError } from "./types";

const COLOR_PROPERTIES = new Set([
  "color",
  "background",
  "background-color",
  "border-color",
  "outline-color",
  "fill",
  "stroke",
]);

export function extractCssStructure(rawText: string): { cssInfo: ParsedCssInfo; parseErrors: ParsedParseError[] } {
  const cssInfo: ParsedCssInfo = {
    focusRules: [],
    focusVisibleRules: [],
    outlineRemovals: [],
    colorDeclarations: [],
    mediaQueries: [],
  };
  const parseErrors: ParsedParseError[] = [];

  try {
    const root = postcss.parse(rawText);

    root.walkRules((rule) => {
      const selector = rule.selector;
      const line = rule.source?.start?.line ?? 1;
      if (/:focus-visible/i.test(selector)) cssInfo.focusVisibleRules.push({ line, selector });
      else if (/:focus\b/i.test(selector)) cssInfo.focusRules.push({ line, selector });

      rule.walkDecls((decl) => {
        const declLine = decl.source?.start?.line ?? line;
        const prop = decl.prop.toLowerCase();

        if (prop === "outline" && /\bnone\b|:\s*0\b|^0(\s|$)/.test(decl.value)) {
          cssInfo.outlineRemovals.push({ line: declLine, selector });
        }
        // `var(--x)`: the actual color can't be resolved from this file
        // alone, so it's recorded as-is rather than guessing a value.
        if (COLOR_PROPERTIES.has(prop) && (looksLikeColorValue(decl.value) || decl.value.includes("var("))) {
          cssInfo.colorDeclarations.push({ line: declLine, selector, property: decl.prop, value: decl.value });
        }
      });
    });

    root.walkAtRules("media", (atRule) => {
      cssInfo.mediaQueries.push({ line: atRule.source?.start?.line ?? 1, params: atRule.params });
    });
  } catch (err) {
    parseErrors.push({ message: `CSS parse error: ${err instanceof Error ? err.message : String(err)}` });
  }

  return { cssInfo, parseErrors };
}
