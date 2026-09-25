import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { listConnections } from "@/lib/analytics/googleConnections";
import { isGa4OAuthConfigured } from "@/lib/analytics/googleOAuth";

// GET /api/analytics/google/connections — every stored GA4 Google account
// (never tokens), plus whether the server has the env vars to connect more.
export async function GET() {
  await connectToDatabase();
  return NextResponse.json({ configured: isGa4OAuthConfigured(), connections: await listConnections() });
}
