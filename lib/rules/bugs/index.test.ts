import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { BUG_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function largeInlinePayloadFindings(theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = BUG_RULES.find((r) => r.ruleId === "PERF-LARGE-INLINE-001")!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("PERF-LARGE-INLINE-001", () => {
  it("flags an inline <script> over ~10KB", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": `<html><body><script>${"a".repeat(10_500)}</script></body></html>`,
    });
    cleanup = theme.cleanup;
    const findings = largeInlinePayloadFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("KB");
  });

  it("does not flag a small inline <script>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><body><script>console.log('hi')</script></body></html>",
    });
    cleanup = theme.cleanup;
    expect(largeInlinePayloadFindings(theme)).toHaveLength(0);
  });

  it("does not flag an external <script src> regardless of how the attribute is written", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": `<html><body><script src="theme.js">${"a".repeat(20_000)}</script></body></html>`,
    });
    cleanup = theme.cleanup;
    expect(largeInlinePayloadFindings(theme)).toHaveLength(0);
  });

  it("flags an inline <style> block over ~10KB", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": `<html><head><style>${".a{color:red}".repeat(1000)}</style></head></html>`,
    });
    cleanup = theme.cleanup;
    const findings = largeInlinePayloadFindings(theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("<style>");
  });

  it("does not flag an external stylesheet <link>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><link rel="stylesheet" href="theme.css"></head></html>',
    });
    cleanup = theme.cleanup;
    expect(largeInlinePayloadFindings(theme)).toHaveLength(0);
  });
});
