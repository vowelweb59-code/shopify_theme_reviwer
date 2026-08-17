import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
// Registers the "Theme" model with Mongoose — required for the populate()
// below; see app/api/reports/route.ts for why this matters.
import "@/models/theme";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;

  const auditRun = await AuditRun.findById(id).populate("themeId", "name sourceFileName").lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  return NextResponse.json({ auditRun });
}
