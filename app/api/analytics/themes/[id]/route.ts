import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { updateTheme } from "@/lib/analytics/themes";
import { themeErrorResponse } from "@/lib/analytics/routeErrors";
import { kickOffSyncAfterMapping } from "@/lib/analytics/sync/kickoff";

// PATCH /api/analytics/themes/[id] — { name? }, { pagePathPrefix? } and/or
// { googleConnectionId, ga4PropertyId } to change the property (validated
// before saving). A new property or page filter restarts the theme's
// history, and its sync then starts in the background.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Theme id");
  await connectToDatabase();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  try {
    const theme = await updateTheme(id, body);
    if (theme.connectionStatus === "connected" && !theme.syncedThroughDate) kickOffSyncAfterMapping(theme.id);
    return NextResponse.json({ theme });
  } catch (err) {
    return themeErrorResponse(err, "update theme");
  }
}
