import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Requirement, REQUIREMENT_SOURCE_TYPES, REQUIREMENT_STATUSES, RULE_STATUSES } from "@/models/requirement";
import { Rule } from "@/models/rule";
import { FINDING_CATEGORIES } from "@/models/finding";

// "static" = checked by analyzing the theme's own source (a Rule doc
// exists for this requirement); "live" = checked only by visiting a real
// demo store URL (ruleStatus is implemented/partial but no static Rule
// exists — the LIVE-* convention scripts/seed-rules.ts already scans for);
// "none" = not implemented by anything yet. Powers the Insights "Code
// Review" (static + none) / "Store Review" (live) split.
export type RequirementImplementationType = "static" | "live" | "none";

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);

  const filter: Record<string, unknown> = {};
  const sourceType = searchParams.get("sourceType");
  const category = searchParams.get("category");
  const ruleStatus = searchParams.get("ruleStatus");
  const status = searchParams.get("status");

  if (sourceType) {
    if (!REQUIREMENT_SOURCE_TYPES.includes(sourceType as (typeof REQUIREMENT_SOURCE_TYPES)[number])) {
      return NextResponse.json({ error: `sourceType must be one of: ${REQUIREMENT_SOURCE_TYPES.join(", ")}` }, { status: 400 });
    }
    filter.sourceType = sourceType;
  }
  if (category) {
    if (!FINDING_CATEGORIES.includes(category as (typeof FINDING_CATEGORIES)[number])) {
      return NextResponse.json({ error: `category must be one of: ${FINDING_CATEGORIES.join(", ")}` }, { status: 400 });
    }
    filter.category = category;
  }
  if (ruleStatus) {
    if (!RULE_STATUSES.includes(ruleStatus as (typeof RULE_STATUSES)[number])) {
      return NextResponse.json({ error: `ruleStatus must be one of: ${RULE_STATUSES.join(", ")}` }, { status: 400 });
    }
    filter.ruleStatus = ruleStatus;
  }
  if (status) {
    if (!REQUIREMENT_STATUSES.includes(status as (typeof REQUIREMENT_STATUSES)[number])) {
      return NextResponse.json({ error: `status must be one of: ${REQUIREMENT_STATUSES.join(", ")}` }, { status: 400 });
    }
    filter.status = status;
  }

  const requirements = await Requirement.find(filter).sort({ requirementId: 1 }).lean();

  const rules = await Rule.find().select("requirementId").lean();
  const requirementIdsWithRule = new Set(rules.filter((r) => r.requirementId).map((r) => r.requirementId as string));

  const withImplementationType = requirements.map((req) => {
    let implementationType: RequirementImplementationType;
    if (req.ruleStatus === "not_implemented") implementationType = "none";
    else if (requirementIdsWithRule.has(req.requirementId)) implementationType = "static";
    else implementationType = "live";
    return { ...req, implementationType };
  });

  return NextResponse.json({ requirements: withImplementationType });
}
