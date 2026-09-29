import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { presetNamesFor } from "@/lib/sales/presetNames";
import { Theme } from "@/models/theme";

// GET /api/sales/themes — the themes a sales sheet can be uploaded for, with their presets.
export async function GET() {
  await connectToDatabase();
  const themes = await Theme.find({}).select("name themeStorePresets").sort({ name: 1 }).lean<{ _id: unknown; name: string; themeStorePresets?: { name: string }[] }[]>();
  return NextResponse.json({ themes: themes.map((t) => ({ id: String(t._id), name: t.name, presets: presetNamesFor(t) })) });
}
