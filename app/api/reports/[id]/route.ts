import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { Requirement } from "@/models/requirement";
// Registers the "Theme" model with Mongoose — required for the populate()
// below; see app/api/reports/route.ts for why this matters.
import "@/models/theme";
import { computeCoverage, computeCoverageByCategory } from "@/lib/audit/coverage";
import { computeReadiness } from "@/lib/audit/readiness";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;

  const auditRun = await AuditRun.findById(id).populate("themeId", "name sourceFileName").lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const [findings, requirements] = await Promise.all([
    Finding.find({ auditRunId: id }).sort({ createdAt: -1 }).lean(),
    Requirement.find().select("ruleStatus category").lean(),
  ]);

  const coverage = computeCoverage(requirements);
  const coverageByCategory = computeCoverageByCategory(requirements);
  const readiness = auditRun.status === "complete" ? computeReadiness(findings, coverage.percentage) : null;

  return NextResponse.json({ auditRun, findings, coverage, coverageByCategory, readiness });
}
