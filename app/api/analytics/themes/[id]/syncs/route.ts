import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { listThemeSyncs } from "@/lib/analytics/sync/runSync";

// GET /api/analytics/themes/[id]/syncs — the theme's 20 most recent sync jobs.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Theme id");
  await connectToDatabase();
  return NextResponse.json({ syncs: await listThemeSyncs(id) });
}
