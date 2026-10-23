import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { reprocessFlaggedReports } from "@/lib/chat/importReports";

/** Re-checks the stored reports that needed a look, against the current themes, projects and team. */
export async function POST() {
  await connectToDatabase();
  try {
    return NextResponse.json(await reprocessFlaggedReports());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Re-checking failed." }, { status: 500 });
  }
}
