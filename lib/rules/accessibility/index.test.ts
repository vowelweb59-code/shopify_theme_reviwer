import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { ACCESSIBILITY_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function outlineFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = ACCESSIBILITY_RULES.find((r) => r.ruleId === "A11Y-OUTLINE-REMOVAL-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("A11Y-OUTLINE-REMOVAL-001", () => {
  it("flags outline removal with no focus replacement anywhere in the file", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".btn { outline: none; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(outlineFindings(theme)).toHaveLength(1);
  });

  it("does not flag when a separate :focus rule on the same selector provides a replacement", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".btn { outline: 0; } .btn:focus { box-shadow: 0 0 0 2px blue; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(outlineFindings(theme)).toHaveLength(0);
  });

  // Regression test: found auditing Shopify's own Dawn theme. The removal
  // can be declared directly inside its own :focus rule (not a separate
  // plain-selector rule) while a sibling :focus-visible rule supplies the
  // real replacement — the removal's own selector must be pseudo-class-
  // stripped the same way the candidate replacements are, or this valid
  // pattern is misread as having no replacement at all.
  it("does not flag outline:none set inside the :focus rule itself when :focus-visible supplies a replacement", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".btn:focus { outline: none; } .btn:focus-visible { outline: 2px solid blue; }",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    expect(outlineFindings(theme)).toHaveLength(0);
  });

  it("formats a multi-line compound selector as a single line in the finding message", () => {
    const theme = buildTestTheme({
      "assets/theme.css": ".a:hover.a:after,\n.b:hover.b:after {\n  outline: none;\n}",
      "layout/theme.liquid": "<html></html>",
    });
    cleanup = theme.cleanup;
    const findings = outlineFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).not.toContain("\n");
  });
});
