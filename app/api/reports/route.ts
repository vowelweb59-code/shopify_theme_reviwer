import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
// Registers the "Theme" model with Mongoose — required for the populate()
// below to resolve, since nothing else in this route references Theme by
// name. Without it, this only works by accident, depending on some other
// route having already imported it earlier in the process's lifetime.
import "@/models/theme";

// GET /api/reports[?themeId=] — the audit-run list: just the fields the
// Reports table and a report's "compare with" picker show, not whole runs
// (which carry enhancement detections, page-speed data, timings, ...).
export async function GET(request: Request) {
  const themeId = new URL(request.url).searchParams.get("themeId");
  if (themeId && !isValidObjectId(themeId)) return invalidIdResponse("Theme id");
  await connectToDatabase();
  const auditRuns = await AuditRun.find(themeId ? { themeId } : {})
    .select("_id themeId status startedAt completedAt error")
    .populate("themeId", "name sourceFileName")
    .sort({ startedAt: -1 })
    .lean();
  return NextResponse.json({ auditRuns });
}
