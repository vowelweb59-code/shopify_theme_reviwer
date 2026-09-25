import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { disconnectTheme } from "@/lib/analytics/themes";
import { themeErrorResponse } from "@/lib/analytics/routeErrors";

// POST /api/analytics/themes/[id]/disconnect — removes the GA4 mapping;
// the theme stays, back to "unmapped".
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Theme id");
  await connectToDatabase();
  try {
    return NextResponse.json({ theme: await disconnectTheme(id) });
  } catch (err) {
    return themeErrorResponse(err, "disconnect theme");
  }
}
