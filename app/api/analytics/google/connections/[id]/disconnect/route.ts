import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { disconnectConnection } from "@/lib/analytics/googleConnections";

// POST /api/analytics/google/connections/[id]/disconnect — deletes the
// stored tokens but keeps the account row (see disconnectConnection for why
// it doesn't also revoke at Google).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Connection id");
  await connectToDatabase();

  const connection = await disconnectConnection(id);
  if (!connection) return NextResponse.json({ error: "Google connection not found." }, { status: 404 });
  return NextResponse.json({ connection });
}
