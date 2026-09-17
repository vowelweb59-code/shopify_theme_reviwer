import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { uploadThemeVersion } from "@/lib/themes/uploadThemeVersion";

/**
 * Uploads a new version's ZIP for an existing theme. Reuploading a version
 * string that already exists never replaces or deletes anything — it
 * resolves to the same ThemeVersion, and either reuses the existing
 * ThemeZip (byte-identical re-upload) or adds a new one under it (changed
 * source without a version bump). Never runs an audit.
 */
export async function POST(request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  await connectToDatabase();
  const { themeId } = await params;

  const theme = await Theme.findById(themeId);
  if (!theme) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A theme ZIP file is required." }, { status: 400 });
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
