import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { googleErrorCode } from "@/lib/analytics/googleOAuth";
import { adsAccessToken, hasDeveloperToken, isAdsConfigured, listAdsAccounts, loadAdsConnection } from "@/lib/ads/googleAds";
import { AdsConnection } from "@/models/ads-connection";

// GET /api/ads: connection status and, when connected, the Google Ads accounts the user can open.
export async function GET() {
  await connectToDatabase();
  const base = { configured: isAdsConfigured(), developerToken: hasDeveloperToken() };
  const connection = await loadAdsConnection();
  if (!connection) return NextResponse.json({ ...base, connected: false });
  if (connection.status !== "active") return NextResponse.json({ ...base, connected: false, email: connection.email, error: connection.lastError ?? "Google access was removed. Reconnect." });
  const status = { ...base, connected: true, email: connection.email };
  if (!base.developerToken) return NextResponse.json({ ...status, accounts: [], error: "Add GOOGLE_ADS_DEVELOPER_TOKEN on the server to read your Google Ads accounts." });
  try {
    return NextResponse.json({ ...status, accounts: await listAdsAccounts(await adsAccessToken(connection)) });
  } catch (err) {
    if (googleErrorCode(err) === "invalid_grant") {
      connection.status = "revoked";
      connection.lastError = "Google access was removed or expired. Reconnect Google Ads.";
      await connection.save();
      return NextResponse.json({ ...base, connected: false, email: connection.email, error: connection.lastError });
    }
    return NextResponse.json({ ...status, accounts: [], error: err instanceof Error ? err.message : "Couldn't read Google Ads." });
  }
}

// DELETE /api/ads: disconnects (forgets the stored tokens).
export async function DELETE() {
  await connectToDatabase();
  await AdsConnection.deleteOne({ key: "ads" });
  return NextResponse.json({ ok: true });
}
