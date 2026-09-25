import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { discoverProperties } from "@/lib/analytics/themes";
import { themeErrorResponse } from "@/lib/analytics/routeErrors";

// GET /api/analytics/google/connections/[id]/properties — every GA4
// property this Google account can read, each flagged with the theme that
// already uses it (if any). Fetched live from the GA4 Admin API.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Connection id");
  await connectToDatabase();
  try {
    return NextResponse.json({ properties: await discoverProperties(id) });
  } catch (err) {
    return themeErrorResponse(err, "property discovery");
  }
}
