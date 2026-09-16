import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";

// One row per theme, from its latest *complete* run only — a small,
// single-user internal tool's theme count doesn't warrant an aggregation
// pipeline over a straightforward per-theme lookup (same style as the rest
// of the app/api/reports/* routes).
export async function GET() {
  await connectToDatabase();
  const themes = await Theme.find().select("name").lean();

  const rows = await Promise.all(
    themes.map(async (theme) => {
      const latestRun = await AuditRun.findOne({ themeId: theme._id, status: "complete" })
        .sort({ startedAt: -1 })
        .select("_id startedAt pageSpeed")
        .lean();
      if (!latestRun) return null;

      const openPerformanceFindingCount = await Finding.countDocuments({
        auditRunId: latestRun._id,
        category: "Performance",
        status: "open",
      });

      return {
        themeId: theme._id,
        themeName: theme.name,
        runId: latestRun._id,
        startedAt: latestRun.startedAt,
        pageSpeed: latestRun.pageSpeed ?? [],
        openPerformanceFindingCount,
      };
    })
  );

  return NextResponse.json({ themes: rows.filter((r): r is NonNullable<typeof r> => r !== null) });
}
