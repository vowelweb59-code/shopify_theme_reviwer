import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { AuditRun } from "@/models/audit-run";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";

// One row per theme, from its latest *complete* run — mirrors
// app/api/page-speed/route.ts's per-theme-lookup style. Detection itself
// isn't computed here: it's already persisted per run as
// AuditRun.enhancementDetections (see app/api/audit/run/route.ts's
// detectEnhancementsForRun, which runs on every audit regardless of
// whether a demo URL was supplied — this is purely a static-source check).
export async function GET() {
  await connectToDatabase();
  const themes = await Theme.find().select("name").lean();

  const rows = await Promise.all(
    themes.map(async (theme) => {
      const latestRun = await AuditRun.findOne({ themeId: theme._id, status: "complete" })
        .sort({ startedAt: -1 })
        .select("_id startedAt enhancementDetections")
        .lean();
      if (!latestRun) return null;

      const detections = new Map<string, boolean>(
        (latestRun.enhancementDetections ?? []).map((d: { pointId: string; detected: boolean }) => [d.pointId, d.detected])
      );
      const features = AVAILABLE_FEATURES.map((feature) => ({
        id: feature.id,
        label: feature.label,
        category: feature.category,
        note: feature.note ?? null,
        status: featureStatus(feature, detections),
      }));
      const detectedCount = features.filter((f) => f.status === "detected").length;
      const checkedCount = features.filter((f) => f.status !== "not_checked").length;

      return {
        themeId: theme._id,
        themeName: theme.name,
        runId: latestRun._id,
        startedAt: latestRun.startedAt,
        detectedCount,
        checkedCount,
        totalCount: features.length,
        features,
      };
    })
  );

  return NextResponse.json({ themes: rows.filter((r): r is NonNullable<typeof r> => r !== null) });
}
