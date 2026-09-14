import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { EnhancementPoint } from "@/models/enhancement-point";
import { EnhancementSheet } from "@/models/enhancement-sheet";
import { buildEnhancementSheetTabs, type SheetEnhancementPoint } from "@/lib/export/enhancementSheetRows";
import { withEnhancementSheetFormatting } from "@/lib/google/enhancementSheetFormatting";
import {
  createGoogleSheet,
  updateGoogleSheet,
  getSpreadsheetSheetsList,
  GoogleSheetsNotConnectedError,
  GoogleSheetSpreadsheetNotFoundError,
  type SpreadsheetSheetInfo,
} from "@/lib/google/sheetsExport";

const SHEET_TITLE = "Shopify Theme Auditor — Future Updates";

// POST (not GET) — same reasoning as app/api/reports/[id]/export/google-sheet/route.ts:
// this creates or updates a persistent spreadsheet, an irreversible-ish
// side effect unlike the other (idempotent, download-only) export formats.
// Unlike that route, there's no diff/merge step: a point's `status` already
// lives in the database and is the single source of truth, so every export
// is a full rewrite of current state, not a reconciliation against
// whatever the sheet said last time.
export async function POST() {
  await connectToDatabase();

  const points = (await EnhancementPoint.find().lean()) as unknown as SheetEnhancementPoint[];
  const tabs = withEnhancementSheetFormatting(buildEnhancementSheetTabs(points));
  if (tabs.length === 0) {
    return NextResponse.json({ error: "There are no enhancement points to export yet." }, { status: 400 });
  }

  // findOneAndUpdate with upsert doubles as "get or create the singleton"
  // — same pattern as lib/audit/readinessConfigStore.ts's loadReadinessConfig.
  const sheetDoc = await EnhancementSheet.findOneAndUpdate({}, {}, { upsert: true, returnDocument: "after" });

  let existingSheets: SpreadsheetSheetInfo[] | null = null;
  let reused = false;

  if (sheetDoc.googleSpreadsheetId) {
    try {
      existingSheets = await getSpreadsheetSheetsList(sheetDoc.googleSpreadsheetId);
      reused = true;
    } catch (err) {
      if (err instanceof GoogleSheetSpreadsheetNotFoundError) {
        existingSheets = null;
      } else if (err instanceof GoogleSheetsNotConnectedError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      } else {
        return NextResponse.json(
          { error: `Failed to reach the existing Google Sheet: ${err instanceof Error ? err.message : String(err)}` },
          { status: 502 }
        );
      }
    }
  }

  const recreated = Boolean(sheetDoc.googleSpreadsheetId) && !reused;

  try {
    const result =
      reused && sheetDoc.googleSpreadsheetId && existingSheets
        ? await updateGoogleSheet(sheetDoc.googleSpreadsheetId, tabs, existingSheets)
        : await createGoogleSheet(SHEET_TITLE, tabs);

    sheetDoc.googleSpreadsheetId = result.spreadsheetId;
    sheetDoc.googleSheetUrl = result.url;
    await sheetDoc.save();

    return NextResponse.json({ url: sheetDoc.googleSheetUrl, reused, recreated });
  } catch (err) {
    if (err instanceof GoogleSheetsNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: `Failed to update the Google Sheet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
