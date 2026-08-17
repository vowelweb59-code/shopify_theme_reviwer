import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { disconnectGoogle } from "@/lib/google/oauth";

export async function POST() {
  await connectToDatabase();
  await disconnectGoogle();
  return NextResponse.json({ connected: false });
}
