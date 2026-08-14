import { afterEach, describe, expect, it } from "vitest";
import { buildTestTheme } from "./buildTestTheme";
import { FIXTURE_THEMES } from "./fixtureThemes";
import { runRules } from "@/lib/audit/runRules";
import { ALL_RULES } from "@/lib/rules/registry";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function runFixture(name: keyof typeof FIXTURE_THEMES) {
  const theme = buildTestTheme(FIXTURE_THEMES[name]);
  cleanup = theme.cleanup;
  return runRules(theme.parsed.files, ALL_RULES).findings;
}

describe("canonical fixture themes (phase-4 §19)", () => {
  it("valid theme: no blocker/high-severity findings from a well-formed theme", () => {
    const findings = runFixture("validTheme");
    expect(findings.filter((f) => f.severity === "blocker" || f.severity === "high")).toEqual([]);
  });

  it("broken schema: malformed JSON inside {% schema %} is caught", () => {
    const findings = runFixture("brokenSchemaTheme");
    expect(findings.some((f) => f.ruleId === "SCHEMA-JSON-VALID-001")).toBe(true);
  });

  it("missing translation: a referenced locale key absent from the default locale file is caught", () => {
    const findings = runFixture("missingTranslationTheme");
    expect(findings.some((f) => f.ruleId === "REF-LOCALE-KEY-MISSING-001")).toBe(true);
  });

  it("broken asset: a referenced asset absent from assets/ is caught", () => {
    const findings = runFixture("brokenAssetTheme");
    expect(findings.some((f) => f.ruleId === "REF-ASSET-MISSING-001")).toBe(true);
  });

  it("broken snippet: a {% render %} of a nonexistent snippet is caught", () => {
    const findings = runFixture("brokenSnippetTheme");
    expect(findings.some((f) => f.ruleId === "REF-SNIPPET-MISSING-001")).toBe(true);
  });

  it("duplicate ids: two schema settings sharing an id are caught", () => {
    const findings = runFixture("duplicateIdsTheme");
    expect(findings.some((f) => f.ruleId === "SCHEMA-DUPLICATE-ID-001")).toBe(true);
  });

  it("H1 problems: missing, multiple, and skipped-level are each caught", () => {
    const findings = runFixture("h1ProblemsTheme");
    expect(findings.some((f) => f.ruleId === "SEO-H1-MISSING-COMPOSED-001")).toBe(true);
    expect(findings.some((f) => f.ruleId === "SEO-H1-MULTIPLE-COMPOSED-001")).toBe(true);
    expect(findings.some((f) => f.ruleId === "A11Y-HEADING-SKIP-001")).toBe(true);
  });

  it("JSON-LD problems: missing Product schema and malformed JSON-LD are each caught", () => {
    const findings = runFixture("jsonLdProblemsTheme");
    expect(findings.some((f) => f.ruleId === "AEO-PRODUCT-SCHEMA-001")).toBe(true);
    expect(findings.some((f) => f.ruleId === "AEO-JSONLD-VALID-001")).toBe(true);
  });

  it("accessibility relationships: missing label, broken aria-labelledby, and broken aria-describedby are each caught", () => {
    const findings = runFixture("accessibilityRelationshipsTheme");
    expect(findings.some((f) => f.ruleId === "SHOPIFY-A11Y-LABEL-001")).toBe(true);
    const ariaFindings = findings.filter((f) => f.ruleId === "REF-ARIA-ID-MISSING-001");
    expect(ariaFindings.some((f) => f.finding.includes("aria-labelledby"))).toBe(true);
    expect(ariaFindings.some((f) => f.finding.includes("aria-describedby"))).toBe(true);
  });

  it("dynamic theme: non-literal section/snippet references never produce a false 'missing' finding", () => {
    const findings = runFixture("dynamicThemeTheme");
    expect(findings.some((f) => f.ruleId === "REF-SNIPPET-MISSING-001" || f.ruleId === "REF-SECTION-MISSING-001")).toBe(false);
  });
});
