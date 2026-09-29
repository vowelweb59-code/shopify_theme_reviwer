import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { SalesFileError, isXlsx, matchThemeForTab, parseSalesFile, readWorkbook, salesFromRows } from "@/lib/sales/parseSalesFile";
import { importSales } from "@/lib/sales/importSales";
import { startDetection } from "@/lib/sales/detectionJob";
import { Theme } from "@/models/theme";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type TabResult = {
  tab: string;
  themeName: string | null;
  inserted: number;
  duplicates: number;
  newStores: number;
  rowsRead: number;
  skipped: number;
  /** Why the tab wasn't imported (no matching theme, not a sales table). */
  error?: string;
};

// POST /api/sales/import — multipart { file, themeId? }.
// - With themeId: that theme's sales (from a .csv/.tsv, or the matching /
//   first sales tab of an .xlsx).
// - Without: every tab of an .xlsx workbook, each imported for the theme
//   its tab is named after (the user keeps all themes in one sheet, one
//   tab per theme).
// Rows already imported are skipped; new stores get checked for their
// preset in the background.
export async function POST(request: Request) {
  const form = await request.formData();
  const themeId = form.get("themeId")?.toString() || "";
  const file = form.get("file");
  if (themeId && !isValidObjectId(themeId)) return invalidIdResponse("themeId");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose the sales sheet to upload." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "The file is larger than 10 MB." }, { status: 400 });

  await connectToDatabase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const tabs: TabResult[] = [];
    if (themeId) {
      const theme = await Theme.findById(themeId).select("name").lean<{ name: string }>();
      if (!theme) return NextResponse.json({ error: "Theme not found." }, { status: 404 });
      const parsed = await parseSalesFile(buffer, file.name, theme.name);
      const result = await importSales(themeId, parsed.sales);
      tabs.push({ tab: file.name, themeName: theme.name, ...result, rowsRead: parsed.sales.length, skipped: parsed.skipped });
    } else {
      if (!isXlsx(buffer, file.name)) {
        return NextResponse.json({ error: "Choose the theme for a .csv file, or upload the whole workbook as .xlsx to import every tab." }, { status: 400 });
      }
      const themes = await Theme.find({}).select("name").lean<{ _id: unknown; name: string }[]>();
      for (const sheet of await readWorkbook(buffer)) {
        const theme = matchThemeForTab(sheet.name, themes);
        const base = { tab: sheet.name, themeName: theme?.name ?? null, inserted: 0, duplicates: 0, newStores: 0, rowsRead: 0, skipped: 0 };
        if (!theme) {
          tabs.push({ ...base, error: "No theme with this name." });
          continue;
        }
        try {
          const parsed = salesFromRows(sheet.rows);
          const result = await importSales(String(theme._id), parsed.sales);
          tabs.push({ ...base, ...result, rowsRead: parsed.sales.length, skipped: parsed.skipped });
        } catch (err) {
          // One broken tab shouldn't sink the rest of the workbook.
          if (err instanceof SalesFileError) tabs.push({ ...base, error: "Not a sales table (no Date / Shop Domain header)." });
          else {
            console.error(`[sales] importing tab "${sheet.name}" failed:`, err);
            tabs.push({ ...base, error: "Couldn't import this tab." });
          }
        }
      }
      if (!tabs.some((t) => !t.error)) {
        return NextResponse.json({ error: "No tab matched a theme name. Name each tab after its theme (e.g. “Adorn”), or pick the theme first.", tabs }, { status: 400 });
      }
    }
    startDetection();
    return NextResponse.json({ tabs });
  } catch (err) {
    if (err instanceof SalesFileError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[sales] import failed:", err);
    return NextResponse.json(
      { error: `Couldn't read that file (${err instanceof Error ? err.message.slice(0, 120) : "unknown error"}). Upload the sheet as .xlsx or .csv.` },
      { status: 400 }
    );
  }
}
