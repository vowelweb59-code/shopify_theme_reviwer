import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { verifySpace } from "@/lib/chat/verifySpace";

/** Read-only: compares the whole Theme Status Group with the stored reports and lists anything not imported. */
export async function POST() {
  await connectToDatabase();
  try {
    return NextResponse.json(await verifySpace());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "The check failed." }, { status: 502 });
  }
}
