import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeRankingCheckState } from "@/models/theme-ranking-check-state";

/**
 * Lightweight sibling of GET /api/themes for the Theme Store Ranking
 * table on /demo-store — just the fields that table needs, skipping the
 * per-theme version/audit/scoreboard lookups the full themes list does.
 */
export async function GET() {
  await connectToDatabase();

  const [themes, state] = await Promise.all([
    Theme.find()
      .select("name themeStoreSlug themeStoreCheckedAt themeStoreError themeStorePresets themeStoreRank themeStoreRankPage themeStoreRankCheckedAt")
      .sort({ name: 1 })
      .lean(),
    ThemeRankingCheckState.findOne(),
  ]);

  return NextResponse.json({
    themes,
    lastCheckedAt: state?.lastCheckedAt ?? null,
    nextCheckAt: state?.nextCheckAt ?? null,
    lastError: state?.lastError ?? null,
  });
}
