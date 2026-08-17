import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Requirement } from "@/models/requirement";
import { Rule } from "@/models/rule";

// Maintenance dashboard + requirement<->rule traceability matrix
// (phase-7 §23-24) — the control center for keeping the auditor itself
// accurate, distinct from the audit-facing pages. Deliberately a single
// GET with no query params: this is a small admin view, not something
// that needs pagination or filtering server-side (the client filters the
// already-small matrix instead, same pattern as /rules).
export async function GET() {
  await connectToDatabase();

  const [requirements, rules] = await Promise.all([
    Requirement.find().sort({ requirementId: 1 }).lean(),
    Rule.find().lean(),
  ]);

  const ruleByRequirementId = new Map(rules.filter((r) => r.requirementId).map((r) => [r.requirementId as string, r]));

  const matrix = requirements.map((req) => {
    const rule = ruleByRequirementId.get(req.requirementId);
    return {
      requirementId: req.requirementId,
      requirementTitle: req.title,
      category: req.category,
      requirementStatus: req.status,
      ruleStatus: req.ruleStatus,
      ruleId: rule?.ruleId ?? null,
      hasTests: rule?.hasTests ?? null,
      criticality: rule?.criticality ?? null,
      sourceName: req.sourceName,
      sourceUrl: req.sourceUrl,
    };
  });

  const activeRules = rules.filter((r) => r.enabled);
  const summary = {
    totalRequirements: requirements.length,
    activeRules: activeRules.length,
    unimplementedRequirements: requirements.filter((r) => r.ruleStatus === "not_implemented").length,
    partialRules: requirements.filter((r) => r.ruleStatus === "partial").length,
    rulesWithoutTests: activeRules.filter((r) => !r.hasTests).length,
    deprecatedRequirements: requirements.filter((r) => r.status === "deprecated").length,
    criticalRulesWithoutTests: activeRules.filter((r) => r.criticality === "critical" && !r.hasTests).length,
  };

  return NextResponse.json({ summary, matrix });
}
