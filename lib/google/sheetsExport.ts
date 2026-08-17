import { google } from "googleapis";
import { getAuthorizedClient } from "./oauth";
import { buildSheetFormattingRequests } from "./sheetsFormatting";
import type { SheetTab } from "@/lib/export/sheetRows";

export class GoogleSheetsNotConnectedError extends Error {}

// Google Sheets tab titles can't contain : \ / ? * [ ] and are capped at
// 100 chars — none of the app's category names actually hit this, but the
// sanitization is cheap insurance against the external API rejecting the
// request outright.
function sanitizeTabTitle(title: string): string {
  return title.replace(/[:\\/?*[\]]/g, "-").slice(0, 100);
}

/** Creates a new spreadsheet with one tab per entry in `tabs`, each tab's own header+rows starting at A1, then applies formatting (frozen/styled header, column widths, severity color-coding, tab colors). Returns the sheet's edit URL. */
export async function createGoogleSheet(title: string, tabs: SheetTab[]): Promise<{ url: string; spreadsheetId: string }> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new GoogleSheetsNotConnectedError("Google Sheets is not connected. Connect it from Settings first.");
  }
  if (tabs.length === 0) {
    throw new Error("This audit run has no findings to export.");
  }

  const sheets = google.sheets({ version: "v4", auth: client });
  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: tabs.map((tab) => ({ properties: { title: sanitizeTabTitle(tab.title) } })),
    },
  });
  const spreadsheetId = data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet id.");

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: tabs.map((tab) => ({ range: `'${sanitizeTabTitle(tab.title)}'!A1`, values: tab.rows })),
    },
  });

  // Matches each tab back to the sheetId Google assigned it, by title
  // (created in the same order as `tabs`, but matching by title rather
  // than assuming index order lines up is one less thing that can drift).
  const sheetIdByTitle = new Map(
    (data.sheets ?? []).map((sheet) => [sheet.properties?.title, sheet.properties?.sheetId])
  );

  const formattingRequests = tabs.flatMap((tab) => {
    const sheetId = sheetIdByTitle.get(sanitizeTabTitle(tab.title));
    if (sheetId == null) return [];
    const dataRowCount = tab.rows.length - 1; // rows[0] is the header
    return buildSheetFormattingRequests(sheetId, dataRowCount, tab.title);
  });

  if (formattingRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formattingRequests } });
  }

  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, spreadsheetId };
}
