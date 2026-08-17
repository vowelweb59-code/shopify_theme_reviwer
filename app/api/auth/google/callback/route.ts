import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { GoogleAuth } from "@/models/google-auth";
import { exchangeCodeForTokens } from "@/lib/google/oauth";

// GET /api/auth/google/callback — Google redirects here with either
// ?code=... (consent granted) or ?error=... (denied/cancelled). Only one
// Google account can be connected at a time, so a new connect replaces
// whatever was stored before rather than accumulating rows.
export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams, origin } = new URL(request.url);
  const settingsUrl = new URL("/settings", origin);

  const error = searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("googleError", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = searchParams.get("code");
  if (!code) {
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("googleError", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const { email, accessToken, refreshToken, expiryDate, scope } = await exchangeCodeForTokens(code);
    await GoogleAuth.deleteMany({});
    await GoogleAuth.create({ googleEmail: email, accessToken, refreshToken, expiryDate, scope });
    settingsUrl.searchParams.set("google", "connected");
  } catch (err) {
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("googleError", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.redirect(settingsUrl);
}
