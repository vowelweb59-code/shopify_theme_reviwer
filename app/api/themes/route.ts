import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { AuditRun } from "@/models/audit-run";
import { EnhancementPoint } from "@/models/enhancement-point";
import { pickLatestVersion } from "@/lib/themes/compareVersions";
import { deriveChecksForAuditRun, loadCheckCatalog } from "@/lib/themes/deriveChecksForAuditRun";
import { computeScoreboard } from "@/lib/themes/computeScoreboard";
import { uploadThemeVersion } from "@/lib/themes/uploadThemeVersion";
import { sanitizePresets } from "@/lib/themes/presets";
import type { EnhancementDetectionRecord } from "@/lib/audit/enhancementReport";

/**
 * Lists every Theme (including ones created before this module existed,
 * via the original /audit page) alongside its version-tracking state. A
 * theme with no ThemeVersion yet — every pre-existing theme, until someone
 * uploads a version for it — comes back with latestVersion: null rather
 * than a fabricated placeholder; the UI shows "no version tracked yet".
 */
export async function GET() {
  await connectToDatabase();

  const themes = await Theme.find().sort({ name: 1 }).lean();
  const themeIds = themes.map((t) => t._id);
  const versions = await ThemeVersion.find({ themeId: { $in: themeIds } }).lean();

  const versionsByTheme = new Map<string, typeof versions>();
  for (const v of versions) {
    const key = String(v.themeId);
    const list = versionsByTheme.get(key) ?? [];
    list.push(v);
    versionsByTheme.set(key, list);
  }

  // Fetched once, not per theme — the same global catalog every theme's
  // "Opportunities"/"Features" scores are computed against (see
  // computeScoreboard.ts), same as the Theme Detail route does.
  // Likewise the requirement/rule catalog every theme's checks derive from.
  const [enhancementPoints, catalog] = await Promise.all([EnhancementPoint.find().select("pointId themeCount").lean(), loadCheckCatalog()]);

  const rows = await Promise.all(
    themes.map(async (theme) => {
      const themeVersions = versionsByTheme.get(String(theme._id)) ?? [];
      const latestVersion = pickLatestVersion(themeVersions);
      if (!latestVersion) {
        return { theme, latestVersion: null, latestAudit: null, checkTotals: null, scoreboard: null };
      }

      // Only what this route and the list page use — not the whole run
      // (timings, diagnostics, version snapshots, ...).
      const latestAudit = await AuditRun.findOne({ themeVersionId: latestVersion._id, status: "complete" })
        .sort({ startedAt: -1 })
        .select("_id startedAt enhancementDetections pageSpeed demoStorePresets")
        .lean();
      if (!latestAudit) {
        return { theme, latestVersion, latestAudit: null, checkTotals: null, scoreboard: null };
      }

      const checks = await deriveChecksForAuditRun(latestAudit._id, Boolean(latestAudit.demoStorePresets?.length), catalog);

      // Same reasoning as the Theme Detail route: if this run's own PSI
      // calls all failed, fall back to the most recent other complete run
      // (any version) that does have page-speed data, so a transient PSI
      // outage doesn't make this comparison show "—" when a real score is
      // known — keeps this table consistent with what Theme Detail shows.
      let pageSpeed = latestAudit.pageSpeed ?? [];
      if (pageSpeed.length === 0) {
        const themeVersionIds = themeVersions.map((v) => v._id);
        const fallbackAudit = await AuditRun.findOne({
          themeVersionId: { $in: themeVersionIds },
          status: "complete",
          _id: { $ne: latestAudit._id },
          "pageSpeed.0": { $exists: true },
        })
          .sort({ startedAt: -1 })
          .select("pageSpeed")
          .lean();
        if (fallbackAudit) pageSpeed = fallbackAudit.pageSpeed ?? [];
      }

      const scoreboard = computeScoreboard({
        categories: checks.categories,
        pageSpeed,
        enhancementDetections: latestAudit.enhancementDetections as EnhancementDetectionRecord[] | undefined,
        enhancementPoints,
        themeStoreFeatures: theme.themeStoreFeatures,
      });
      return { theme, latestVersion, latestAudit, checkTotals: checks.totals, scoreboard };
    })
  );

  return NextResponse.json({ themes: rows });
}

/**
 * Creates a Theme (or reuses an existing one by name, exactly like
 * /api/audit/run does) and its first ThemeVersion/ThemeZip. Never runs an
 * audit — "Run Audit" is a separate, explicit step.
 */
export async function POST(request: Request) {
  await connectToDatabase();

  const formData = await request.formData();
  const themeName = formData.get("themeName")?.toString().trim();
  const file = formData.get("file");

  if (!themeName) {
    return NextResponse.json({ error: "themeName is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A theme ZIP file is required." }, { status: 400 });
  }

  const theme = (await Theme.findOne({ name: themeName })) ?? (await Theme.create({ name: themeName }));
  if (theme.sourceFileName !== file.name) {
    theme.sourceFileName = file.name;
    await theme.save();
  }

  const presetsRaw = formData.get("demoStorePresets")?.toString();
  if (presetsRaw) {
    try {
      const presets = sanitizePresets(JSON.parse(presetsRaw));
      if (presets.length > 0) {
        theme.demoStorePresets = presets;
        await theme.save();
      }
    } catch {
      // malformed JSON — ignore, same best-effort handling as /api/audit/run
    }
  }

  const result = await uploadThemeVersion(theme._id, file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { theme, themeVersion: result.themeVersion, themeZip: result.themeZip, reusedZip: result.reusedZip },
    { status: 201 }
  );
}
