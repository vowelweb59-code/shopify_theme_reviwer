import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { getGoogleConnectionStatus } from "@/lib/google/oauth";

export async function GET() {
  await connectToDatabase();
  const status = await getGoogleConnectionStatus();
  return NextResponse.json(status);
}
