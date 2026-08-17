import ExcelJS from "exceljs";
import type { CoverageResult } from "@/lib/audit/coverage";

export type XlsxFinding = {
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: string;
  status?: string | null;
  finding: string;
  recommendation?: string | null;
  sourceUrl?: string | null;
};

export type XlsxSummary = { total: number; blocker: number; high: number; medium: number; low: number };

const FINDING_COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "Severity", key: "severity", width: 10 },
  { header: "Category", key: "category", width: 20 },
  { header: "Rule ID", key: "ruleId", width: 24 },
  { header: "Requirement ID", key: "requirementId", width: 22 },
  { header: "Finding", key: "finding", width: 60 },
  { header: "Recommendation", key: "recommendation", width: 40 },
  { header: "File", key: "filePath", width: 30 },
  { header: "Line", key: "lineNumber", width: 8 },
  { header: "Status", key: "status", width: 10 },
  { header: "Source", key: "sourceUrl", width: 30 },
];

function addFindingsSheet(workbook: ExcelJS.Workbook, name: string, findings: XlsxFinding[]) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = FINDING_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  for (const f of findings) {
    sheet.addRow({
      severity: f.severity,
      category: f.category,
      ruleId: f.ruleId,
      requirementId: f.requirementId ?? "",
      finding: f.finding,
      recommendation: f.recommendation ?? "",
      filePath: f.filePath,
      lineNumber: f.lineNumber ?? "",
      status: f.status ?? "open",
      sourceUrl: f.sourceUrl ?? "",
    });
  }
}

// Suggested sheet layout per phase-5 §13. "Rule Coverage" and "Diagnostics"
// are single small tables rather than one row per finding.
export async function buildReportXlsx(opts: {
  themeName: string;
  auditRunId: string;
  summary: XlsxSummary;
  findings: XlsxFinding[];
  coverage: CoverageResult;
  coverageByCategory: Record<string, CoverageResult>;
  diagnostics?: { parserWarnings: number; unresolvedDynamicReferences: number; filesSkipped: number; rulesSkippedDueToError: number };
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Shopify Theme Auditor";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRows([
    ["Theme", opts.themeName],
    ["Audit ID", opts.auditRunId],
    [],
    ["Total findings", opts.summary.total],
    ["Blocker", opts.summary.blocker],
    ["High", opts.summary.high],
    ["Medium", opts.summary.medium],
    ["Low", opts.summary.low],
    [],
    ["Automated coverage %", Number(opts.coverage.percentage.toFixed(1))],
    ["Requirements total", opts.coverage.total],
    ["Implemented", opts.coverage.implemented],
    ["Partial", opts.coverage.partial],
    ["Not implemented", opts.coverage.notImplemented],
  ]);
  summarySheet.getColumn(1).font = { bold: true };
  summarySheet.getColumn(1).width = 24;
  summarySheet.getColumn(2).width = 40;

  addFindingsSheet(workbook, "Findings", opts.findings);

  const categorySheets: Record<string, string> = {
    "Theme Store Compliance": "Shopify Compliance",
    Accessibility: "Accessibility",
    "Technical SEO": "Technical SEO",
    "Technical AEO": "Technical AEO",
    Bug: "Bugs",
    "Internal Standard": "Internal Standards",
  };
  for (const [category, sheetName] of Object.entries(categorySheets)) {
    addFindingsSheet(workbook, sheetName, opts.findings.filter((f) => f.category === category));
  }

  const coverageSheet = workbook.addWorksheet("Rule Coverage");
  coverageSheet.columns = [
    { header: "Category", key: "category", width: 24 },
    { header: "Total", key: "total", width: 10 },
    { header: "Implemented", key: "implemented", width: 14 },
    { header: "Partial", key: "partial", width: 10 },
    { header: "Not implemented", key: "notImplemented", width: 16 },
    { header: "Coverage %", key: "percentage", width: 12 },
  ];
  coverageSheet.getRow(1).font = { bold: true };
  for (const [category, c] of Object.entries(opts.coverageByCategory)) {
    coverageSheet.addRow({ category, total: c.total, implemented: c.implemented, partial: c.partial, notImplemented: c.notImplemented, percentage: Number(c.percentage.toFixed(1)) });
  }

  if (opts.diagnostics) {
    const diagSheet = workbook.addWorksheet("Diagnostics");
    diagSheet.addRows([
      ["Parser warnings", opts.diagnostics.parserWarnings],
      ["Unresolved dynamic references", opts.diagnostics.unresolvedDynamicReferences],
      ["Files skipped", opts.diagnostics.filesSkipped],
      ["Rules skipped due to error", opts.diagnostics.rulesSkippedDueToError],
    ]);
    diagSheet.getColumn(1).font = { bold: true };
    diagSheet.getColumn(1).width = 30;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
