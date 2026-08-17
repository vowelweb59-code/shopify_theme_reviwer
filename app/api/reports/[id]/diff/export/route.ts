import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { computeFindingsDiff } from "@/lib/audit/diffFindings";
import { buildDiffCsv, type DiffCsvFinding } from "@/lib/export/diffCsv";
// Registers the "Theme" model with Mongoose — required for the populate()
// below; see app/api/reports/route.ts for why this matters.
import "@/models/theme";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  const url = new URL(request.url);
  const baselineId = url.searchParams.get("baseline");
  const format = url.searchParams.get("format") ?? "csv";

  if (!baselineId) {
    return NextResponse.json({ error: "A baseline audit run id is required (?baseline=<id>)." }, { status: 400 });
  }
  if (format !== "csv") {
    return NextResponse.json({ error: "format must be 'csv'." }, { status: 400 });
  }

  const [currentRun, baselineRun] = await Promise.all([
    AuditRun.findById(id).populate("themeId", "name").lean(),
    AuditRun.findById(baselineId).lean(),
  ]);
  if (!currentRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });
  if (!baselineRun) return NextResponse.json({ error: "Baseline audit run not found." }, { status: 404 });
  if (String(currentRun.themeId._id ?? currentRun.themeId) !== String(baselineRun.themeId)) {
    return NextResponse.json({ error: "The baseline audit run belongs to a different theme." }, { status: 400 });
  }

  const [currentFindings, baselineFindings] = await Promise.all([
    Finding.find({ auditRunId: id }).lean(),
    Finding.find({ auditRunId: baselineId }).lean(),
  ]);
  const diff = computeFindingsDiff(baselineFindings as unknown as DiffCsvFinding[], currentFindings as unknown as DiffCsvFinding[]);
  const csv = buildDiffCsv(diff.findings);

  const themeName =
    currentRun.themeId && typeof currentRun.themeId === "object" && "name" in currentRun.themeId
      ? String(currentRun.themeId.name)
      : "Unknown theme";
  const filenameBase = `${themeName.replace(/[^a-z0-9-]+/gi, "-")}-diff-${baselineId}-vs-${id}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
