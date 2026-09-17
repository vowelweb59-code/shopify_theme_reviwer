import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { ThemeZip } from "@/models/theme-zip";
import { executeAuditRun } from "@/lib/audit/executeAuditRun";
import { localUploadSource } from "@/lib/themes/themeSource";
import type { PresetLink } from "@/lib/audit/liveCheck";

const HTTP_URL_RE = /^https?:\/\//i;

function parseDemoStorePresets(body: unknown): PresetLink[] {
  const raw = (body as { demoStorePresets?: unknown } | null)?.demoStorePresets;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, i) => ({
      label: String((entry as { label?: unknown })?.label ?? "").trim() || `Preset ${i + 1}`,
      url: String((entry as { url?: unknown })?.url ?? "").trim(),
    }))
    .filter((p) => HTTP_URL_RE.test(p.url));
}

/**
 * "Run Audit" — the explicit, separate step from upload (spec §7). Runs
 * against the most recently uploaded ThemeZip for this version (re-upload
 * a new ZIP first via POST .../versions to audit different bytes), calling
 * the exact same executeAuditRun the original /api/audit/run route uses.
 * Always creates a new AuditRun — never overwrites a previous one.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ themeId: string; versionId: string }> }
) {
  await connectToDatabase();
  const { themeId, versionId } = await params;

  const [theme, themeVersion] = await Promise.all([Theme.findById(themeId), ThemeVersion.findById(versionId)]);
  if (!theme) return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  if (!themeVersion || String(themeVersion.themeId) !== String(theme._id)) {
    return NextResponse.json({ error: "Theme version not found." }, { status: 404 });
  }

  const themeZip = await ThemeZip.findOne({ themeVersionId: themeVersion._id }).sort({ uploadedAt: -1 });
  if (!themeZip) {
    return NextResponse.json({ error: "No ZIP has been uploaded for this version yet." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const demoStorePresets = parseDemoStorePresets(body);

  const buffer = await localUploadSource(themeZip).getZipBuffer();
  const result = await executeAuditRun({
    theme,
    buffer,
    demoStorePresets,
    themeVersionId: themeVersion._id,
    themeZipId: themeZip._id,
  });

  if (!result.ok) {
    return NextResponse.json({ auditRun: result.auditRun, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ auditRun: result.auditRun, findings: result.findings }, { status: 201 });
}
