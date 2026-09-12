import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { Requirement } from "@/models/requirement";
import { EnhancementPoint } from "@/models/enhancement-point";
// Registers the "Theme" model with Mongoose — required for the populate()
// below; see app/api/reports/route.ts for why this matters.
import "@/models/theme";
import { computeCoverage, computeCoverageByCategory } from "@/lib/audit/coverage";
import { computeReadiness } from "@/lib/audit/readiness";
import { loadReadinessConfig } from "@/lib/audit/readinessConfigStore";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Audit run id");

  const auditRun = await AuditRun.findById(id)
    .populate("themeId", "name sourceFileName googleSpreadsheetId googleSheetUrl")
    .lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const [findings, requirements, readinessConfig, enhancementPoints] = await Promise.all([
    Finding.find({ auditRunId: id }).sort({ createdAt: -1 }).lean(),
    Requirement.find().select("ruleStatus category").lean(),
    loadReadinessConfig(),
    EnhancementPoint.find().lean(),
  ]);

  const coverage = computeCoverage(requirements);
  const coverageByCategory = computeCoverageByCategory(requirements);
  const readiness = auditRun.status === "complete" ? computeReadiness(findings, coverage.percentage, readinessConfig) : null;

  // enhancementDetections only exists on runs audited after this feature
  // shipped — older runs report enhancementDetectionAvailable: false so the
  // UI can say "re-run this audit" instead of implying every point is absent.
  type EnhancementDetection = { pointId: string; detected: boolean; matches?: { filePath: string; lineNumber: number | null }[] };
  const enhancementDetections = auditRun.enhancementDetections as EnhancementDetection[] | undefined;
  const detectionAvailable = Array.isArray(enhancementDetections);
  const detectionByPointId = new Map((enhancementDetections ?? []).map((d) => [d.pointId, d]));
  const enhancementReport = enhancementPoints
    .map((p) => {
      const detection = detectionByPointId.get(p.pointId);
      return { ...p, detected: detection?.detected ?? null, matches: detection?.matches ?? [] };
    })
    .sort((a, b) => b.themeCount - a.themeCount);

  return NextResponse.json({
    auditRun,
    findings,
    coverage,
    coverageByCategory,
    readiness,
    enhancementPoints: enhancementReport,
    enhancementDetectionAvailable: detectionAvailable,
  });
}
