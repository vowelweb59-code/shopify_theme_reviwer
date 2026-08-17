import { describe, expect, it } from "vitest";
import { computeFindingsDiff } from "@/lib/audit/diffFindings";
import { buildDiffCsv } from "./diffCsv";

function finding(overrides: Record<string, unknown> = {}) {
  return {
    ruleId: "A11Y-IMG-ALT-001",
    requirementId: "SHOPIFY-A11Y-001",
    category: "Accessibility",
    filePath: "sections/hero.liquid",
    lineNumber: 10,
    severity: "high" as const,
    finding: "Image is missing an alt attribute.",
    sourceUrl: "https://example.com/req",
    ...overrides,
  };
}

describe("buildDiffCsv", () => {
  it("writes a header row followed by one row per diff finding", () => {
    const diff = computeFindingsDiff([finding()], [finding()]);
    const csv = buildDiffCsv(diff.findings);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Diff Status,Severity,Category,Rule ID,Requirement ID,File,Previous Line,Current Line,Previous Finding,Current Finding,Source"
    );
    expect(lines[1]).toContain("still_present,high,Accessibility,A11Y-IMG-ALT-001");
  });

  it("shows previous and current finding text separately for a changed row", () => {
    const diff = computeFindingsDiff(
      [finding({ finding: "Old message." })],
      [finding({ finding: "New message entirely." })]
    );
    const csv = buildDiffCsv(diff.findings);
    expect(csv).toContain("Old message.");
    expect(csv).toContain("New message entirely.");
  });

  it("leaves the previous-line/previous-finding columns empty for a new finding", () => {
    const diff = computeFindingsDiff([], [finding()]);
    const csv = buildDiffCsv(diff.findings);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.startsWith("new,")).toBe(true);
  });
});
