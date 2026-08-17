import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Requirement } from "@/models/requirement";
import { ALL_RULES } from "@/lib/rules/registry";

type CheckStatus = "healthy" | "unhealthy";

// GET /api/health (phase-8 §25) — for an uptime monitor or deploy smoke
// test to hit, not for end users. "Rules" checks the in-code rule
// registry actually loaded; "requirements" checks the DB-seeded
// knowledge base is non-empty, since Mongo being reachable doesn't by
// itself mean the app has anything to audit against.
export async function GET() {
  let database: CheckStatus = "unhealthy";
  let requirements: CheckStatus = "unhealthy";

  try {
    await connectToDatabase();
    database = "healthy";
    const requirementCount = await Requirement.countDocuments();
    requirements = requirementCount > 0 ? "healthy" : "unhealthy";
  } catch {
    // Left as "unhealthy" — a DB connection failure also fails the requirements check.
  }

  const rules: CheckStatus = ALL_RULES.length > 0 ? "healthy" : "unhealthy";
  const status: CheckStatus = database === "healthy" && rules === "healthy" && requirements === "healthy" ? "healthy" : "unhealthy";

  return NextResponse.json({ status, database, rules, requirements }, { status: status === "healthy" ? 200 : 503 });
}
