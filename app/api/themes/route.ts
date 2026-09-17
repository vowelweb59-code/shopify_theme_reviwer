import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { AuditRun } from "@/models/audit-run";
import { pickLatestVersion } from "@/lib/themes/compareVersions";
import { deriveChecksForAuditRun } from "@/lib/themes/deriveChecksForAuditRun";
import { uploadThemeVersion } from "@/lib/themes/uploadThemeVersion";

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

  const rows = await Promise.all(
    themes.map(async (theme) => {
      const themeVersions = versionsByTheme.get(String(theme._id)) ?? [];
      const latestVersion = pickLatestVersion(themeVersions);
      if (!latestVersion) {
        return { theme, latestVersion: null, latestAudit: null, checkTotals: null };
      }

      const latestAudit = await AuditRun.findOne({ themeVersionId: latestVersion._id, status: "complete" })
        .sort({ startedAt: -1 })
        .lean();
      if (!latestAudit) {
        return { theme, latestVersion, latestAudit: null, checkTotals: null };
      }

      const { totals } = await deriveChecksForAuditRun(latestAudit._id, Boolean(latestAudit.demoStorePresets?.length));
      return { theme, latestVersion, latestAudit, checkTotals: totals };
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

  const result = await uploadThemeVersion(theme._id, file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { theme, themeVersion: result.themeVersion, themeZip: result.themeZip, reusedZip: result.reusedZip },
    { status: 201 }
  );
}
