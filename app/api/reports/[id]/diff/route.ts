import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import {
  attributeNewFindings,
  computeFindingsDiff,
  countNewOrEscalatedHighRiskFindings,
  summarizeDiffByCategory,
  summarizeDiffBySeverity,
  type DiffableFinding,
} from "@/lib/audit/diffFindings";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";

// Mongoose Map-typed fields normally come back as plain objects through
// .lean(), but that's an implementation detail, not a contract — handle a
// real Map too rather than assuming.
function toPlainRecord(value: unknown): Record<string, number> {
  if (value instanceof Map) return Object.fromEntries(value);
  return (value as Record<string, number> | undefined) ?? {};
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Audit run id");
  const baselineId = new URL(request.url).searchParams.get("baseline");

  if (!baselineId) {
    return NextResponse.json({ error: "A baseline audit run id is required (?baseline=<id>)." }, { status: 400 });
  }
  if (!isValidObjectId(baselineId)) return invalidIdResponse("Baseline audit run id");

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
  const attributedFindings = attributeNewFindings(
    diff.findings,
    toPlainRecord(baselineRun.ruleVersionSnapshot),
    toPlainRecord(currentRun.ruleVersionSnapshot)
  );
  const attributedDiff = { ...diff, findings: attributedFindings };
  const categorySummary = summarizeDiffByCategory(attributedDiff);
  const severitySummary = summarizeDiffBySeverity(attributedDiff);
  const newOrEscalatedHighRiskCount = countNewOrEscalatedHighRiskFindings(attributedDiff);

  return NextResponse.json({
    baselineAuditId: baselineId,
    currentAuditId: id,
    ...attributedDiff,
    categorySummary,
    severitySummary,
    newOrEscalatedHighRiskCount,
  });
}
