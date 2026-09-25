import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { validateConnection } from "@/lib/analytics/googleConnections";

// POST /api/analytics/google/connections/[id]/validate — forces a token
// refresh to prove the account's access still works, updating its status
// (active / revoked / error) to match.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Connection id");
  await connectToDatabase();

  try {
    const { outcome, connection } = await validateConnection(id);
    if (!connection) return NextResponse.json({ error: "Google connection not found." }, { status: 404 });
    return NextResponse.json({ outcome, connection });
  } catch (err) {
    console.error("[ga4] validate failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't validate this connection." }, { status: 500 });
  }
}
