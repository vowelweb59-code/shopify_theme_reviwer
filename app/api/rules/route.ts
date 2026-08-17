import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Rule } from "@/models/rule";
import { FINDING_CATEGORIES } from "@/models/finding";

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);

  const filter: Record<string, unknown> = {};
  const category = searchParams.get("category");
  const enabled = searchParams.get("enabled");
  if (category) {
    if (!FINDING_CATEGORIES.includes(category as (typeof FINDING_CATEGORIES)[number])) {
      return NextResponse.json({ error: `category must be one of: ${FINDING_CATEGORIES.join(", ")}` }, { status: 400 });
    }
    filter.category = category;
  }
  if (enabled !== null) filter.enabled = enabled === "true";

  const rules = await Rule.find(filter).sort({ ruleId: 1 }).lean();
  return NextResponse.json({ rules });
}
