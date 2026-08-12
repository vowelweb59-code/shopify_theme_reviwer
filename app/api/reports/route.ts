import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";

export async function GET() {
  await connectToDatabase();
  const auditRuns = await AuditRun.find()
    .populate("themeId", "name sourceFileName")
    .sort({ startedAt: -1 })
    .lean();
  return NextResponse.json({ auditRuns });
}
