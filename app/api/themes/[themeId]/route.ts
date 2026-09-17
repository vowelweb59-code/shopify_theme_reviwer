import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { AuditRun } from "@/models/audit-run";
import { compareVersions, parseVersionForSort, pickLatestVersion } from "@/lib/themes/compareVersions";
import { deriveChecksForAuditRun } from "@/lib/themes/deriveChecksForAuditRun";

/**
 * One aggregate payload for the whole Theme Detail page (Overview / All
 * Checks / Previous Audits tabs) — matching the existing /api/reports/[id]
 * convention of one round-trip per page rather than one endpoint per tab.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;

  const theme = await Theme.findById(themeId).lean();
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }

  const versions = await ThemeVersion.find({ themeId }).lean();
  const sortedVersions = [...versions].sort((a, b) => compareVersions(parseVersionForSort(b.version), parseVersionForSort(a.version)));
  const latestVersion = pickLatestVersion(versions);

  const versionIds = versions.map((v) => v._id);
  const allAudits =
    versionIds.length > 0
      ? await AuditRun.find({ themeVersionId: { $in: versionIds } }).sort({ startedAt: -1 }).lean()
      : [];

  const versionById = new Map(versions.map((v) => [String(v._id), v]));

  let latestAudit = null;
  let checks = null;
  if (latestVersion) {
    latestAudit = allAudits.find((a) => String(a.themeVersionId) === String(latestVersion._id) && a.status === "complete") ?? null;
    if (latestAudit) {
      checks = await deriveChecksForAuditRun(latestAudit._id, Boolean(latestAudit.demoStorePresets?.length));
    }
  }

  // "Previous Audits" — every complete run across every version, newest
  // first, each with its own derived totals (cheap: Requirement/Rule are
  // small collections, Finding lookups are indexed by auditRunId).
  const previousAudits = await Promise.all(
    allAudits
      .filter((a) => a.status === "complete")
      .map(async (a) => {
        const { totals } = await deriveChecksForAuditRun(a._id, Boolean(a.demoStorePresets?.length));
        return {
          auditRunId: a._id,
          version: versionById.get(String(a.themeVersionId))?.version ?? null,
          startedAt: a.startedAt,
          totals,
        };
      })
  );

  return NextResponse.json({
    theme,
    versions: sortedVersions,
    latestVersion,
    latestAudit,
    checks,
    previousAudits,
  });
}
