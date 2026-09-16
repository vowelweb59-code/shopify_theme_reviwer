import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { PERFORMANCE_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = PERFORMANCE_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("PERF-IMG-DIMENSIONS-001", () => {
  it("flags an <img> missing both width and height", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": '<img src="hero.jpg" alt="Hero">',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-IMG-DIMENSIONS-001", theme)).toHaveLength(1);
  });

  it("flags an <img> missing only height", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": '<img src="hero.jpg" alt="Hero" width="800">',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-IMG-DIMENSIONS-001", theme)).toHaveLength(1);
  });

  it("does not flag an <img> with both width and height", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": '<img src="hero.jpg" alt="Hero" width="800" height="600">',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-IMG-DIMENSIONS-001", theme)).toHaveLength(0);
  });
});

describe("PERF-RENDER-BLOCKING-SCRIPT-001", () => {
  it("flags an external <script> in <head> with no async/defer/module", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="https://example.com/widget.js"></script></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-RENDER-BLOCKING-SCRIPT-001", theme)).toHaveLength(1);
  });

  it("does not flag a deferred external <script> in <head>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="https://example.com/widget.js" defer></script></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-RENDER-BLOCKING-SCRIPT-001", theme)).toHaveLength(0);
  });

  it("does not flag an async external <script> in <head>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="https://example.com/widget.js" async></script></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-RENDER-BLOCKING-SCRIPT-001", theme)).toHaveLength(0);
  });

  it('does not flag a type="module" external <script> in <head>', () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="https://example.com/widget.js" type="module"></script></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-RENDER-BLOCKING-SCRIPT-001", theme)).toHaveLength(0);
  });

  it("does not flag an inline <script> in <head>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head><script>console.log('hi');</script></head><body></body></html>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-RENDER-BLOCKING-SCRIPT-001", theme)).toHaveLength(0);
  });

  it("does not flag a blocking external <script> in <body>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head></head><body><script src="https://example.com/widget.js"></script></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-RENDER-BLOCKING-SCRIPT-001", theme)).toHaveLength(0);
  });
});
