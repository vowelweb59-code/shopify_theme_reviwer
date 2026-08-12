import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Rule } from "@/models/rule";

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);

  const filter: Record<string, unknown> = {};
  const category = searchParams.get("category");
  const enabled = searchParams.get("enabled");
  if (category) filter.category = category;
  if (enabled !== null) filter.enabled = enabled === "true";

  const rules = await Rule.find(filter).sort({ ruleId: 1 }).lean();
  return NextResponse.json({ rules });
}
