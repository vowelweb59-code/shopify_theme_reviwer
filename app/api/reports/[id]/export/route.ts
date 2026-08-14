import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { buildFindingsCsv } from "@/lib/export/csv";
import { buildReportHtml, renderReportPdf } from "@/lib/export/pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format");

  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json({ error: "format must be 'csv' or 'pdf'." }, { status: 400 });
  }

  const auditRun = await AuditRun.findById(id).populate("themeId", "name").lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const findings = await Finding.find({ auditRunId: id }).sort({ severity: 1, filePath: 1 }).lean();
  const themeName =
    auditRun.themeId && typeof auditRun.themeId === "object" && "name" in auditRun.themeId
      ? String(auditRun.themeId.name)
      : "Unknown theme";
  const filenameBase = `${themeName.replace(/[^a-z0-9-]+/gi, "-")}-audit-${id}`;

  if (format === "csv") {
    const csv = buildFindingsCsv(id, themeName, findings);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
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
  const pdf = await renderReportPdf(html);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
