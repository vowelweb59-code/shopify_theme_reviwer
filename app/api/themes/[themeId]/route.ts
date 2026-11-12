import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { AuditRun } from "@/models/audit-run";
import { EnhancementPoint } from "@/models/enhancement-point";
import { compareVersions, parseVersionForSort, pickLatestVersion } from "@/lib/themes/compareVersions";
import { deriveChecksForAuditRun, loadCheckCatalog } from "@/lib/themes/deriveChecksForAuditRun";
import { isValidGitUrl } from "@/lib/themes/gitSource";
import { sanitizePresets } from "@/lib/themes/presets";
import { ensureDemoPresets } from "@/lib/themes/ensurePresets";
import { computeScoreboard } from "@/lib/themes/computeScoreboard";
import type { EnhancementDetectionRecord } from "@/lib/audit/enhancementReport";
import type { PageSpeedMetric } from "@/lib/audit/pageSpeed";

/**
 * One aggregate payload for the whole Theme Detail page (Overview / All
 * Checks / Previous Audits tabs) — matching the existing /api/reports/[id]
 * convention of one round-trip per page rather than one endpoint per tab.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");

  const theme = await Theme.findById(themeId).lean();
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }

  // A theme with no saved presets gets them automatically (Theme Store listing + its ZIP), once; the page then shows them.
  if (!theme.demoStorePresets?.length && theme.themeStoreSlug) {
    const filled = await ensureDemoPresets(theme).catch(() => []);
    if (filled.length > 0) theme.demoStorePresets = filled;
  }

  const versions = await ThemeVersion.find({ themeId }).lean();
  const sortedVersions = [...versions].sort((a, b) => compareVersions(parseVersionForSort(b.version), parseVersionForSort(a.version)));
  const latestVersion = pickLatestVersion(versions);

  const versionIds = versions.map((v) => v._id);
  const allAudits =
    versionIds.length > 0
      ? await AuditRun.find({ themeVersionId: { $in: versionIds } })
          .sort({ startedAt: -1 })
          // Every run feeds "Previous Audits"; only the latest's page-speed
          // and enhancement data are used, and the client reads just _id/startedAt.
          .select("_id themeVersionId status startedAt demoStorePresets pageSpeed enhancementDetections")
          .lean()
      : [];
  // One catalog for this run and every previous run's totals below,
  // instead of re-reading Requirement/Rule once per run.
  const catalog = await loadCheckCatalog();

  const versionById = new Map(versions.map((v) => [String(v._id), v]));

  let latestAudit = null;
  let checks = null;
  let scoreboard = null;
  // The page-speed data actually used for the scoreboard/Core Web Vitals
  // display — this run's own, or a fallback's (see pageSpeedFallback
  // below) — returned separately so the client shows the exact same
  // numbers the scoreboard's Desktop/Mobile Performance scores came from.
  let pageSpeed: PageSpeedMetric[] = [];
  // Set only when this run's own page-speed data is entirely missing (e.g.
  // every PageSpeed Insights call failed — see liveCheckErrors) and an
  // older complete run's page-speed data was used instead, so the
  // Desktop/Mobile Performance cards show the last real measurement rather
  // than blanking to "N/A" the moment one run's live checks have a bad day.
  let pageSpeedFallback: { auditRunId: unknown; startedAt: Date } | null = null;
  if (latestVersion) {
    latestAudit = allAudits.find((a) => String(a.themeVersionId) === String(latestVersion._id) && a.status === "complete") ?? null;
    if (latestAudit) {
      checks = await deriveChecksForAuditRun(latestAudit._id, Boolean(latestAudit.demoStorePresets?.length), catalog);
      const enhancementPoints = await EnhancementPoint.find().select("pointId themeCount").lean();

      pageSpeed = latestAudit.pageSpeed ?? [];
      if (pageSpeed.length === 0) {
        const fallbackAudit = allAudits.find(
          (a) => a.status === "complete" && String(a._id) !== String(latestAudit!._id) && a.pageSpeed && a.pageSpeed.length > 0
        );
        if (fallbackAudit) {
          pageSpeed = fallbackAudit.pageSpeed;
          pageSpeedFallback = { auditRunId: fallbackAudit._id, startedAt: fallbackAudit.startedAt };
        }
      }

      scoreboard = computeScoreboard({
        categories: checks.categories,
        pageSpeed,
        enhancementDetections: latestAudit.enhancementDetections as EnhancementDetectionRecord[] | undefined,
        enhancementPoints,
        themeStoreFeatures: theme.themeStoreFeatures,
      });
    }
  }

  // "Previous Audits" — every complete run across every version, newest
  // first, each with its own derived totals (the catalog is loaded once
  // above; Finding lookups are indexed by auditRunId).
  const previousAudits = await Promise.all(
    allAudits
      .filter((a) => a.status === "complete")
      .map(async (a) => {
        const { totals } = await deriveChecksForAuditRun(a._id, Boolean(a.demoStorePresets?.length), catalog);
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
    scoreboard,
    pageSpeed,
    pageSpeedFallback,
    previousAudits,
  });
}

/**
 * Updates a theme's saved default preset demo-store URLs — a convenience
 * default (Themes module) that pre-fills "Run Audit" instead of retyping
 * the theme's style variants every time. Scoped to just this one field for
 * now; not a general theme-update endpoint.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");

  const body = (await request.json().catch(() => null)) as { demoStorePresets?: unknown; gitRepoUrl?: unknown; gitBranch?: unknown } | null;
  // Only the fields present in the body change (saving presets must not wipe the Git settings, and the reverse).
  const update: Record<string, unknown> = {};
  if (body && "demoStorePresets" in body) update.demoStorePresets = sanitizePresets(body.demoStorePresets);
  if (body && "gitRepoUrl" in body) {
    const raw = typeof body.gitRepoUrl === "string" ? body.gitRepoUrl.trim() : "";
    if (raw && !isValidGitUrl(raw)) {
      return NextResponse.json({ error: "The Git URL must start with https:// (for example https://github.com/your-org/your-theme.git)." }, { status: 400 });
    }
    update.gitRepoUrl = raw || null;
    update.gitLastCommit = null; // a new repo is read fresh
  }
  if (body && "gitBranch" in body) {
    const branch = typeof body.gitBranch === "string" ? body.gitBranch.trim() : "";
    if (branch && !/^[\w./-]{1,100}$/.test(branch)) return NextResponse.json({ error: "That branch name isn't valid." }, { status: 400 });
    update.gitBranch = branch || null;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const theme = await Theme.findByIdAndUpdate(themeId, update, { returnDocument: "after" });
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }

  return NextResponse.json({ theme });
}
