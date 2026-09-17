import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { AuditRun } from "@/models/audit-run";
import { ThemeVersion } from "@/models/theme-version";
import { deriveChecksForAuditRun } from "@/lib/themes/deriveChecksForAuditRun";

const RECENT_AUDITS_LIMIT = 8;

/**
 * Read-only aggregation for the Dashboard — no new persisted data. Works
 * across every Theme regardless of which flow created its audits (the
 * original /audit upload or the Themes module), since deriveChecksForAuditRun
 * only needs an auditRunId and doesn't require a themeVersionId link.
 */
export async function GET() {
  await connectToDatabase();

  const themes = await Theme.find().select("_id name").lean();
  const themeIds = themes.map((t) => t._id);

  const [totalAudits, latestPerTheme, recentAudits, versions] = await Promise.all([
    AuditRun.countDocuments({ status: "complete" }),
    Promise.all(
      themeIds.map((themeId) => AuditRun.findOne({ themeId, status: "complete" }).sort({ startedAt: -1 }).lean())
    ),
    AuditRun.find({ themeId: { $in: themeIds }, status: "complete" })
      .sort({ startedAt: -1 })
      .limit(RECENT_AUDITS_LIMIT)
      .lean(),
    ThemeVersion.find({ themeId: { $in: themeIds } }).lean(),
  ]);

  const themeById = new Map(themes.map((t) => [String(t._id), t]));
  const versionById = new Map(versions.map((v) => [String(v._id), v]));

  const latestChecks = await Promise.all(
    latestPerTheme
      .filter((run): run is NonNullable<typeof run> => Boolean(run))
      .map((run) => deriveChecksForAuditRun(run._id, Boolean(run.demoStorePresets?.length)))
  );

  const totals = latestChecks.reduce(
    (acc, c) => ({
      passed: acc.passed + c.totals.passed,
      failed: acc.failed + c.totals.failed,
      warnings: acc.warnings + c.totals.warnings,
      total: acc.total + c.totals.total,
    }),
    { passed: 0, failed: 0, warnings: 0, total: 0 }
  );

  const overallHealthPercent = totals.total > 0 ? Math.round((totals.passed / totals.total) * 100) : null;

  const recentAuditRows = await Promise.all(
    recentAudits.map(async (run) => {
      const { totals: t } = await deriveChecksForAuditRun(run._id, Boolean(run.demoStorePresets?.length));
      return {
        auditRunId: run._id,
        themeName: themeById.get(String(run.themeId))?.name ?? "Unknown",
        version: run.themeVersionId ? (versionById.get(String(run.themeVersionId))?.version ?? null) : null,
        startedAt: run.startedAt,
        passed: t.passed,
        total: t.total,
      };
    })
  );

  return NextResponse.json({
    themeCount: themes.length,
    totalAudits,
    openIssueCount: totals.failed + totals.warnings,
    overallHealthPercent,
    totals,
    recentAudits: recentAuditRows,
  });
}
