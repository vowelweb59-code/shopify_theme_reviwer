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

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = BUG_RULES.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`No rule registered with id ${ruleId}`);
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("PERF-DUPLICATE-ASSET-001", () => {
  it("flags the same script src loaded twice in one file", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid":
        '<html><head><script src="theme.js"></script><script src="theme.js"></script></head></html>',
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("PERF-DUPLICATE-ASSET-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("2 times");
  });

  it("flags the same stylesheet href loaded twice in one file", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid":
        '<html><head><link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="theme.css"></head></html>',
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("PERF-DUPLICATE-ASSET-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("Stylesheet");
  });

  it("does not flag two different scripts in the same file", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="a.js"></script><script src="b.js"></script></head></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("PERF-DUPLICATE-ASSET-001", theme)).toHaveLength(0);
  });
});

describe("REF-SETTINGS-SCOPED-MISSING-001", () => {
  it("flags section.settings.x with no matching id in the section's own schema", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid":
        '<div>{{ section.settings.heading }}</div>{% schema %}{"name": "Hero", "settings": []}{% endschema %}',
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("REF-SETTINGS-SCOPED-MISSING-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("section.settings.heading");
  });

  it("does not flag section.settings.x declared in the section's own schema", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid":
        '<div>{{ section.settings.heading }}</div>{% schema %}{"name": "Hero", "settings": [{"type": "text", "id": "heading"}]}{% endschema %}',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-SCOPED-MISSING-001", theme)).toHaveLength(0);
  });

  it("flags block.settings.x with no matching id in any block type's own settings", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid":
        '<div>{{ block.settings.title }}</div>{% schema %}{"name": "Hero", "blocks": [{"type": "item", "settings": []}]}{% endschema %}',
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("REF-SETTINGS-SCOPED-MISSING-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("block.settings.title");
  });

  it("does not flag block.settings.x declared under a block type's own settings", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid":
        '<div>{{ block.settings.title }}</div>{% schema %}{"name": "Hero", "blocks": [{"type": "item", "settings": [{"type": "text", "id": "title"}]}]}{% endschema %}',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-SCOPED-MISSING-001", theme)).toHaveLength(0);
  });

  // Per the rule's own scoping rationale: a snippet can be rendered from any
  // number of different sections, so section.settings.x/block.settings.x
  // references there are never checked (only sections/*.liquid own a schema).
  it("does not check section.settings.x references outside sections/", () => {
    const theme = buildTestTheme({
      "snippets/shared.liquid": "<div>{{ section.settings.heading }}</div>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("REF-SETTINGS-SCOPED-MISSING-001", theme)).toHaveLength(0);
  });
});
