import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import {
  computeFindingsDiff,
  countNewOrEscalatedHighRiskFindings,
  summarizeDiffByCategory,
  summarizeDiffBySeverity,
  type DiffableFinding,
} from "@/lib/audit/diffFindings";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  const baselineId = new URL(request.url).searchParams.get("baseline");

  if (!baselineId) {
    return NextResponse.json({ error: "A baseline audit run id is required (?baseline=<id>)." }, { status: 400 });
  }

  const [currentRun, baselineRun] = await Promise.all([
    AuditRun.findById(id).lean(),
    AuditRun.findById(baselineId).lean(),
  ]);
  if (!currentRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });
  if (!baselineRun) return NextResponse.json({ error: "Baseline audit run not found." }, { status: 404 });
  if (String(currentRun.themeId) !== String(baselineRun.themeId)) {
    return NextResponse.json({ error: "The baseline audit run belongs to a different theme." }, { status: 400 });
  }

  const [currentFindings, baselineFindings] = await Promise.all([
    Finding.find({ auditRunId: id }).lean(),
    Finding.find({ auditRunId: baselineId }).lean(),
  ]);

  const diff = computeFindingsDiff(baselineFindings as unknown as DiffableFinding[], currentFindings as unknown as DiffableFinding[]);
  const categorySummary = summarizeDiffByCategory(diff);
  const severitySummary = summarizeDiffBySeverity(diff);
  const newOrEscalatedHighRiskCount = countNewOrEscalatedHighRiskFindings(diff);

  return NextResponse.json({
    baselineAuditId: baselineId,
    currentAuditId: id,
    ...diff,
    categorySummary,
    severitySummary,
    newOrEscalatedHighRiskCount,
  });
}
