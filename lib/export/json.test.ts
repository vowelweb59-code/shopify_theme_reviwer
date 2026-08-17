import { describe, expect, it } from "vitest";
import { buildAuditReportJson } from "./json";

describe("buildAuditReportJson", () => {
  it("assembles a normalized report with all sections present", () => {
    const report = buildAuditReportJson({
      auditRunId: "run1",
      themeName: "Adorn",
      startedAt: "2026-08-14T00:00:00.000Z",
      completedAt: "2026-08-14T00:05:00.000Z",
      summary: { total: 1, blocker: 0, high: 1, medium: 0, low: 0 },
      coverage: { total: 10, implemented: 5, partial: 1, notImplemented: 4, percentage: 50 },
      coverageByCategory: { Accessibility: { total: 5, implemented: 3, partial: 0, notImplemented: 2, percentage: 60 } },
      readiness: { status: "NOT_READY", reasons: ["1 unresolved blocker finding."] },
      findings: [
        {
          ruleId: "A11Y-IMG-ALT-001",
          filePath: "sections/hero.liquid",
          category: "Accessibility",
          severity: "high",
          finding: "Missing alt attribute.",
        },
      ],
    });

    expect(report.auditRun).toEqual({ id: "run1", theme: "Adorn", startedAt: "2026-08-14T00:00:00.000Z", completedAt: "2026-08-14T00:05:00.000Z" });
    expect(report.summary.total).toBe(1);
    expect(report.coverage.percentage).toBe(50);
    expect(report.coverageByCategory.Accessibility.percentage).toBe(60);
    expect(report.readiness?.status).toBe("NOT_READY");
    expect(report.findings).toHaveLength(1);
    expect(report.diagnostics).toBeNull();
    expect(typeof report.generatedAt).toBe("string");
  });

  it("defaults diagnostics to null when not provided, rather than omitting the key", () => {
    const report = buildAuditReportJson({
      auditRunId: "run1",
      themeName: "Adorn",
      startedAt: "2026-08-14T00:00:00.000Z",
      completedAt: null,
      summary: { total: 0, blocker: 0, high: 0, medium: 0, low: 0 },
      coverage: { total: 0, implemented: 0, partial: 0, notImplemented: 0, percentage: 0 },
      coverageByCategory: {},
      readiness: null,
      findings: [],
    });
    expect("diagnostics" in report).toBe(true);
    expect(report.diagnostics).toBeNull();
  });
});
