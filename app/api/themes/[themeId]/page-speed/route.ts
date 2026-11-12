import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { isPsiConfigured } from "@/lib/audit/psi";
import { measurePresetHome } from "@/lib/audit/pageSpeed";
import { AuditRun } from "@/models/audit-run";
import { Theme } from "@/models/theme";
import { ThemeVersion } from "@/models/theme-version";

/**
 * Re-measures one preset's home page (mobile and desktop) with PageSpeed Insights and stores the scores on the theme's latest
 * complete audit run, replacing that preset's earlier home-page scores. Only a URL that is one of the theme's saved presets is
 * accepted. Body: { url }. The rest of the audit is untouched; the Desktop/Mobile Performance cards average over all presets.
 */
export async function POST(request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });
  if (!isPsiConfigured()) {
    return NextResponse.json({ error: "PAGESPEED_API_KEY is not configured on the server, so Core Web Vitals cannot be measured." }, { status: 400 });
  }

  await connectToDatabase();
  const theme = await Theme.findById(themeId).select("demoStorePresets").lean<{ demoStorePresets?: { label: string; url: string }[] }>();
  if (!theme) return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  const preset = (theme.demoStorePresets ?? []).find((p) => p.url === url);
  if (!preset) return NextResponse.json({ error: "That URL is not one of this theme's saved presets." }, { status: 400 });

  const versionIds = (await ThemeVersion.find({ themeId }).select("_id").lean()).map((v) => v._id);
  const run = versionIds.length
    ? await AuditRun.findOne({ themeVersionId: { $in: versionIds }, status: "complete" }).sort({ startedAt: -1 }).select("_id pageSpeed")
    : null;
  if (!run) return NextResponse.json({ error: "Run an audit first; the scores are stored on the latest completed audit." }, { status: 409 });

  const { metrics, errors } = await measurePresetHome(preset);
  if (metrics.length === 0) {
    return NextResponse.json({ error: errors.join(" ") || "PageSpeed Insights returned nothing." }, { status: 502 });
  }
  const kept = (run.pageSpeed ?? []).filter((m: { url: string; pageType: string }) => !(m.url === preset.url && m.pageType === "home"));
  run.pageSpeed = [...kept.map((m: { toObject?: () => object }) => (typeof m.toObject === "function" ? m.toObject() : m)), ...metrics];
  await run.save();
  return NextResponse.json({ ok: true, measured: metrics.length, errors });
}
