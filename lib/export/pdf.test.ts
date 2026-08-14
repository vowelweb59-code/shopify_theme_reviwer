import { describe, expect, it } from "vitest";
import { buildReportHtml } from "./pdf";

describe("buildReportHtml", () => {
  it("escapes HTML in finding text so theme source content can't inject markup", () => {
    const html = buildReportHtml({
      themeName: "Adorn",
      auditRunId: "run1",
      startedAt: "2026-08-14",
      findings: [
        {
          ruleId: "R-1",
          filePath: "sections/hero.liquid",
          category: "Bug",
          severity: "high",
          finding: '<script>alert("x")</script>',
        },
      ],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes the summary counts when provided", () => {
    const html = buildReportHtml({
      themeName: "Adorn",
      auditRunId: "run1",
      startedAt: "2026-08-14",
      summary: { total: 5, blocker: 1, high: 2, medium: 1, low: 1 },
      findings: [],
    });
    expect(html).toContain(">5<");
    expect(html).toContain(">1<");
  });

  it("omits the summary block entirely when no summary is given", () => {
    const html = buildReportHtml({ themeName: "Adorn", auditRunId: "run1", startedAt: "2026-08-14", findings: [] });
    expect(html).not.toContain("class=\"summary\"");
  });
});
