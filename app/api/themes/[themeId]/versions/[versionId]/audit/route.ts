import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";
import { ThemeZip } from "@/models/theme-zip";
import type { AuditRunDoc } from "@/models/audit-run";
import { executeAuditRun } from "@/lib/audit/executeAuditRun";
import { localUploadSource } from "@/lib/themes/themeSource";
import { sanitizePresets } from "@/lib/themes/presets";
import { ensureDemoPresets } from "@/lib/themes/ensurePresets";

/**
 * "Run Audit" — the explicit, separate step from upload (spec §7). Runs
 * against the most recently uploaded ThemeZip for this version (re-upload
 * a new ZIP first via POST .../versions to audit different bytes), calling
 * the exact same executeAuditRun the original /api/audit/run route uses.
 * Always creates a new AuditRun — never overwrites a previous one.
 *
 * Responds as soon as the AuditRun row exists (near-instant) instead of
 * waiting for the whole audit to finish — a live-check/page-speed phase
 * can legitimately run for a minute or more, long enough that something
 * between the browser and this server gives up on the request before the
 * audit itself is actually done. The client polls GET /api/audit/[id] for
 * status/progress instead (see currentStage/stageProgress on the model).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ themeId: string; versionId: string }> }
) {
  await connectToDatabase();
  const { themeId, versionId } = await params;
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  if (!isValidObjectId(versionId)) return invalidIdResponse("versionId");

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
  const requestedPresets = sanitizePresets((body as { demoStorePresets?: unknown } | null)?.demoStorePresets);
  // Falls back to the theme's saved default presets when the request
  // supplies none — so calling "Run Audit" still exercises live checks
  // against the theme's known style variants without having to resend
  // them from the client every time.
  // (and, when none are saved either, the demo URLs from the Theme Store listing — see ensureDemoPresets).
  const demoStorePresets = requestedPresets.length > 0 ? requestedPresets : await ensureDemoPresets(theme);
  // URLs typed for this check are kept on the theme, so the theme page's Run Audit and the Git audit read the same stores later.
  if (requestedPresets.length > 0) await Theme.updateOne({ _id: theme._id }, { $set: { demoStorePresets: requestedPresets } });

  const buffer = await localUploadSource(themeZip).getZipBuffer();

  const auditRun = await new Promise<AuditRunDoc & { _id: unknown }>((resolve) => {
    executeAuditRun(
      { theme, buffer, demoStorePresets, themeVersionId: themeVersion._id, themeZipId: themeZip._id },
      { onStarted: resolve }
    ).catch((err) => {
      // executeAuditRun itself never throws — it catches internally and
      // marks the run "failed" (visible to the polling client via status).
      // This only guards against a truly unexpected failure escaping that
      // catch, which would otherwise be an unhandled rejection since
      // nothing else awaits this promise once the response below is sent.
      console.error("executeAuditRun failed unexpectedly after the client was already responded to:", err);
    });
  });

  return NextResponse.json({ auditRun }, { status: 202 });
}
