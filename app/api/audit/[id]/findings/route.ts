import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Finding } from "@/models/finding";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Audit run id");

  // Severity-aware sorting/filtering is a Phase 5 reporting concern —
  // this just returns everything for the run, newest first.
  const findings = await Finding.find({ auditRunId: id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ findings });
}
