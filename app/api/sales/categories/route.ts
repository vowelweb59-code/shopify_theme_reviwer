import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { INDUSTRIES } from "@/lib/themes/industries";
import { listPresetCategories, setManualCategory } from "@/lib/sales/categories";

// GET /api/sales/categories?themeId= — each preset's main category.
export async function GET(request: Request) {
  const themeId = new URL(request.url).searchParams.get("themeId") || null;
  if (themeId && !isValidObjectId(themeId)) return invalidIdResponse("themeId");
  return NextResponse.json({ presets: await listPresetCategories(themeId ? [themeId] : undefined) });
}

// PATCH /api/sales/categories { themeId, presetName, industry } — override a preset's category (null = use the suggestion).
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { themeId?: unknown; presetName?: unknown; industry?: unknown } | null;
  const themeId = typeof body?.themeId === "string" ? body.themeId : "";
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  const presetName = typeof body?.presetName === "string" ? body.presetName.trim() : "";
  if (!presetName || presetName.length > 100) return NextResponse.json({ error: "presetName is required." }, { status: 400 });
  const industry = body?.industry === null || body?.industry === "" ? null : body?.industry;
  if (industry !== null && !INDUSTRIES.some((i) => i.slug === industry)) return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  await setManualCategory(themeId, presetName, industry as string | null);
  return NextResponse.json({ ok: true });
}
