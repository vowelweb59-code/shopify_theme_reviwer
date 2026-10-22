import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { TimeEntry } from "@/models/time-entry";

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; entryId: string }> }) {
  const { projectId, entryId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  if (!isValidObjectId(entryId)) return invalidIdResponse("entryId");
  await connectToDatabase();
  // Scoped by projectId so an entry id from another project can't be removed through this URL.
  const entry = await TimeEntry.findOneAndDelete({ _id: entryId, projectId }).lean();
  if (!entry) return NextResponse.json({ error: "Time entry not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
