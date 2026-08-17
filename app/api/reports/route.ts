import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
// Registers the "Theme" model with Mongoose — required for the populate()
// below to resolve, since nothing else in this route references Theme by
// name. Without it, this only works by accident, depending on some other
// route having already imported it earlier in the process's lifetime.
import "@/models/theme";

export async function GET() {
  await connectToDatabase();
  const auditRuns = await AuditRun.find()
    .populate("themeId", "name sourceFileName")
    .sort({ startedAt: -1 })
    .lean();
  return NextResponse.json({ auditRuns });
}
