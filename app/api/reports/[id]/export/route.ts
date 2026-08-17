import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { Requirement } from "@/models/requirement";
import { computeCoverage, computeCoverageByCategory } from "@/lib/audit/coverage";
import { computeReadiness } from "@/lib/audit/readiness";
import { buildFindingsCsv } from "@/lib/export/csv";
import { buildReportHtml, renderReportPdf } from "@/lib/export/pdf";
import { buildAuditReportJson } from "@/lib/export/json";
import { buildReportXlsx } from "@/lib/export/xlsx";
// Registers the "Theme" model with Mongoose — required for the populate()
// below; see app/api/reports/route.ts for why this matters.
import "@/models/theme";

const FORMATS = ["csv", "pdf", "html", "json", "xlsx"] as const;
type Format = (typeof FORMATS)[number];

const CONTENT_TYPES: Record<Format, string> = {
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") as Format | null;

  if (!format || !FORMATS.includes(format)) {
    return NextResponse.json({ error: `format must be one of: ${FORMATS.join(", ")}` }, { status: 400 });
  }

  const auditRun = await AuditRun.findById(id).populate("themeId", "name").lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const [findings, requirements] = await Promise.all([
    Finding.find({ auditRunId: id }).sort({ severity: 1, filePath: 1 }).lean(),
    Requirement.find().select("ruleStatus category").lean(),
  ]);
  const coverage = computeCoverage(requirements);
  const coverageByCategory = computeCoverageByCategory(requirements);
  const readiness = auditRun.status === "complete" ? computeReadiness(findings, coverage.percentage) : null;

  const themeName =
    auditRun.themeId && typeof auditRun.themeId === "object" && "name" in auditRun.themeId
      ? String(auditRun.themeId.name)
      : "Unknown theme";
  const filenameBase = `${themeName.replace(/[^a-z0-9-]+/gi, "-")}-audit-${id}`;

  function respond(body: string | Buffer) {
    const payload: BodyInit = typeof body === "string" ? body : new Uint8Array(body);
    return new Response(payload, {
      headers: {
        "Content-Type": CONTENT_TYPES[format as Format],
        "Content-Disposition": `attachment; filename="${filenameBase}.${format}"`,
      },
    });
  }

  if (format === "csv") {
    return respond(buildFindingsCsv(id, themeName, findings));
  }

  if (format === "json") {
    const report = buildAuditReportJson({
      auditRunId: id,
      themeName,
      startedAt: new Date(auditRun.startedAt).toISOString(),
      completedAt: auditRun.completedAt ? new Date(auditRun.completedAt).toISOString() : null,
      summary: auditRun.summary ?? { total: 0, blocker: 0, high: 0, medium: 0, low: 0 },
      coverage,
      coverageByCategory,
      readiness,
      findings,
      diagnostics: auditRun.diagnostics ?? undefined,
    });
    return respond(JSON.stringify(report, null, 2));
  }

  if (format === "xlsx") {
    const buffer = await buildReportXlsx({
      themeName,
      auditRunId: id,
      summary: auditRun.summary ?? { total: 0, blocker: 0, high: 0, medium: 0, low: 0 },
      findings,
      coverage,
      coverageByCategory,
      diagnostics: auditRun.diagnostics ?? undefined,
    });
    return respond(buffer);
  }

  const html = buildReportHtml({
    themeName,
    auditRunId: id,
    startedAt: new Date(auditRun.startedAt).toLocaleString(),
    summary: auditRun.summary
      ? {
          total: auditRun.summary.total,
          blocker: auditRun.summary.blocker,
          high: auditRun.summary.high,
          medium: auditRun.summary.medium,
          low: auditRun.summary.low,
        }
      : undefined,
    findings,
  });

  if (format === "html") {
    return respond(html);
  }

  // format === "pdf" — same html builder as above, per phase-5 §13's note
  // that PDF should reuse the same report data/logic rather than a
  // separate implementation.
  const pdf = await renderReportPdf(html);
  return respond(pdf);
}
