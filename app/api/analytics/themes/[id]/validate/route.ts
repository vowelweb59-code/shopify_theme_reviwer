import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { validateTheme } from "@/lib/analytics/themes";
import { themeErrorResponse } from "@/lib/analytics/routeErrors";

// POST /api/analytics/themes/[id]/validate — re-checks that the theme's
// Google account can still read its GA4 property; updates its status.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Theme id");
  await connectToDatabase();
  try {
    return NextResponse.json(await validateTheme(id));
  } catch (err) {
    return themeErrorResponse(err, "validate theme");
  }
}
