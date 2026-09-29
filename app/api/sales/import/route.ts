import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { SalesFileError, parseSalesFile } from "@/lib/sales/parseSalesFile";
import { importSales } from "@/lib/sales/importSales";
import { startDetection } from "@/lib/sales/detectionJob";
import { Theme } from "@/models/theme";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// POST /api/sales/import — multipart { themeId, file } where file is the
// sales sheet as .xlsx / .csv / tab-separated text. Adds rows not seen
// before, then starts preset detection for any new stores in the background.
export async function POST(request: Request) {
  const form = await request.formData();
  const themeId = form.get("themeId")?.toString() ?? "";
  const file = form.get("file");
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose the sales sheet to upload." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "The file is larger than 10 MB." }, { status: 400 });

  await connectToDatabase();
  const theme = await Theme.findById(themeId).select("name").lean();
  if (!theme) return NextResponse.json({ error: "Theme not found." }, { status: 404 });

  try {
    const parsed = await parseSalesFile(Buffer.from(await file.arrayBuffer()), file.name);
    const result = await importSales(themeId, parsed.sales);
    startDetection({ themeId });
    return NextResponse.json({ ...result, rowsRead: parsed.sales.length, skipped: parsed.skipped });
  } catch (err) {
    if (err instanceof SalesFileError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[sales] import failed:", err);
    return NextResponse.json({ error: "Couldn't read that file. Upload the sheet as .xlsx or .csv." }, { status: 400 });
  }
}
