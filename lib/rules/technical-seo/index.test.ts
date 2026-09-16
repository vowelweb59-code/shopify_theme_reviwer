import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "@/lib/test-helpers/buildTestTheme";
import { TECHNICAL_SEO_RULES } from "./index";
import type { RuleFinding } from "@/lib/audit/rules";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function findingsFor(ruleId: string, theme: ReturnType<typeof buildTestTheme>): RuleFinding[] {
  const rule = TECHNICAL_SEO_RULES.find((r) => r.ruleId === ruleId)!;
  return rule.check({ files: theme.parsed.files, index: theme.index });
}

describe("SEO-HEADING-SKIP-001", () => {
  it("flags a heading level that skips an intermediate level within one file", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "<h1>Title</h1><h3>Subheading</h3>" });
    cleanup = theme.cleanup;
    const findings = findingsFor("SEO-HEADING-SKIP-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("h1 to h3");
  });

  it("does not flag headings used in sequence", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "<h1>Title</h1><h2>Subheading</h2><h3>Detail</h3>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-HEADING-SKIP-001", theme)).toHaveLength(0);
  });
});

describe("SEO-H1-MULTIPLE-001", () => {
  it("flags a file with more than one h1", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "<h1>First</h1><h1>Second</h1>" });
    cleanup = theme.cleanup;
    const findings = findingsFor("SEO-H1-MULTIPLE-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("Multiple <h1>");
  });

  it("does not flag a file with a single h1", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": "<h1>Only heading</h1><h2>Sub</h2>" });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-H1-MULTIPLE-001", theme)).toHaveLength(0);
  });
});

describe("SEO-IMG-DIMENSIONS-001", () => {
  it("flags an img missing both width and height", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<img src="hero.jpg" alt="Storefront photo">' });
    cleanup = theme.cleanup;
    const findings = findingsFor("SEO-IMG-DIMENSIONS-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("width and height");
  });

  it("flags an img missing only height", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<img src="hero.jpg" alt="Storefront photo" width="600">' });
    cleanup = theme.cleanup;
    const findings = findingsFor("SEO-IMG-DIMENSIONS-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("height");
  });

  it("does not flag an img with explicit width and height", () => {
    const theme = buildTestTheme({
      "sections/hero.liquid": '<img src="hero.jpg" alt="Storefront photo" width="600" height="400">',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-IMG-DIMENSIONS-001", theme)).toHaveLength(0);
  });

  it("does not flag a decorative image (empty alt) missing dimensions", () => {
    const theme = buildTestTheme({ "sections/hero.liquid": '<img src="divider.svg" alt="">' });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-IMG-DIMENSIONS-001", theme)).toHaveLength(0);
  });
});

describe("SEO-SCRIPT-RENDERBLOCKING-001", () => {
  it("flags a <script src> in <head> with neither async nor defer", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="theme.js"></script></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    const findings = findingsFor("SEO-SCRIPT-RENDERBLOCKING-001", theme);
    expect(findings).toHaveLength(1);
    expect(findings[0].finding).toContain("theme.js");
  });

  it("does not flag a <script src> in <head> with defer", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head><script src="theme.js" defer></script></head><body></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-SCRIPT-RENDERBLOCKING-001", theme)).toHaveLength(0);
  });

  it("does not flag a script in <body>, only <head>", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": '<html><head></head><body><script src="theme.js"></script></body></html>',
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-SCRIPT-RENDERBLOCKING-001", theme)).toHaveLength(0);
  });

  it("does not flag an inline script with no src", () => {
    const theme = buildTestTheme({
      "layout/theme.liquid": "<html><head><script>console.log('inline');</script></head><body></body></html>",
    });
    cleanup = theme.cleanup;
    expect(findingsFor("SEO-SCRIPT-RENDERBLOCKING-001", theme)).toHaveLength(0);
  });
});
