import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;

  const auditRun = await AuditRun.findById(id).populate("themeId", "name sourceFileName").lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const findings = await Finding.find({ auditRunId: id }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({ auditRun, findings });
}
