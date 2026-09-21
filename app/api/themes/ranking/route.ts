import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";

/**
 * Lightweight sibling of GET /api/themes for the Theme Store Ranking
 * table on /demo-store — just the fields that table needs, skipping the
 * per-theme version/audit/scoreboard lookups the full themes list does.
 */
export async function GET() {
  await connectToDatabase();

  const themes = await Theme.find()
    .select("name themeStoreSlug themeStoreCheckedAt themeStoreError themeStoreRank themeStoreRankPage themeStoreRankCheckedAt")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ themes });
}
