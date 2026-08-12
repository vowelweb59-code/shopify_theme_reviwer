import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Requirement } from "@/models/requirement";

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);

  const filter: Record<string, unknown> = {};
  const sourceType = searchParams.get("sourceType");
  const category = searchParams.get("category");
  const ruleStatus = searchParams.get("ruleStatus");
  const status = searchParams.get("status");
  if (sourceType) filter.sourceType = sourceType;
  if (category) filter.category = category;
  if (ruleStatus) filter.ruleStatus = ruleStatus;
  if (status) filter.status = status;

  const requirements = await Requirement.find(filter).sort({ requirementId: 1 }).lean();
  return NextResponse.json({ requirements });
}
