import { google, type sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "./oauth";
import { buildSheetFormattingRequests } from "./sheetsFormatting";
import { TAB_COLUMNS, type SheetTab } from "@/lib/export/sheetRows";

export class GoogleSheetsNotConnectedError extends Error {}

// Thrown when a theme's stored spreadsheet id is no longer reachable —
// e.g. the user deleted the file in Google Drive. Distinguished from other
// failures so the export route can fall back to creating a fresh
// spreadsheet instead of hard-erroring.
export class GoogleSheetSpreadsheetNotFoundError extends Error {}

export type SpreadsheetSheetInfo = { sheetId: number; title: string };

// Google Sheets tab titles can't contain : \ / ? * [ ] and are capped at
// 100 chars — none of the app's category names actually hit this, but the
// sanitization is cheap insurance against the external API rejecting the
// request outright.
function sanitizeTabTitle(title: string): string {
  return title.replace(/[:\\/?*[\]]/g, "-").slice(0, 100);
}

const RESOLVED_COLUMN_INDEX = TAB_COLUMNS.indexOf("Resolved");

// A1-notation column letter for a zero-based column index (4 -> "E").
function columnLetter(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

type TabSheetInfo = { sheetId: number; rangeTitle: string };

/**
 * Writes each tab's rows starting at A1 and applies formatting — shared by
 * createGoogleSheet (brand-new spreadsheet) and updateGoogleSheet (tabs
 * freshly added to an existing spreadsheet under a temporary title — see
 * its own comment for why), since both need identical values+formatting
 * steps once their sheets exist. `sheetInfoByTitle` is keyed by each tab's
 * own (sanitized) `title` — i.e. its category — but its `rangeTitle` is
 * whatever the sheet is *actually* called in the spreadsheet right now,
 * which may be a temporary title mid-update; `tab.title` itself is always
 * used for the cosmetic category-color lookup regardless.
 */
async function writeTabValuesAndFormatting(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabs: SheetTab[],
  sheetInfoByTitle: Map<string, TabSheetInfo>
) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: tabs.map((tab) => ({ range: `'${sheetInfoByTitle.get(sanitizeTabTitle(tab.title))!.rangeTitle}'!A1`, values: tab.rows })),
    },
  });

  // The write above lands the whole grid as RAW text, so the Resolved
  // column's "TRUE"/"FALSE" strings are plain text, not real booleans —
  // the BOOLEAN data-validation checkbox needs an actual boolean value to
  // reflect checked/unchecked state. Re-write just that column with
  // USER_ENTERED so Sheets parses it as a boolean, without risking Sheets
  // reinterpreting rule IDs/paths/finding text elsewhere as numbers/dates.
  const resolvedColumnLetter = columnLetter(RESOLVED_COLUMN_INDEX);
  const resolvedUpdates = tabs
    .filter((tab) => tab.rows.length > 1)
    .map((tab) => {
      const rangeTitle = sheetInfoByTitle.get(sanitizeTabTitle(tab.title))!.rangeTitle;
      return {
        range: `'${rangeTitle}'!${resolvedColumnLetter}2:${resolvedColumnLetter}${tab.rows.length}`,
        values: tab.rows.slice(1).map((row) => [row[RESOLVED_COLUMN_INDEX]]),
      };
    });
  if (resolvedUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: resolvedUpdates },
    });
  }

  const formattingRequests = tabs.flatMap((tab) => {
    const info = sheetInfoByTitle.get(sanitizeTabTitle(tab.title));
    if (!info) return [];
    const dataRowCount = tab.rows.length - 1; // rows[0] is the header
    return buildSheetFormattingRequests(info.sheetId, dataRowCount, tab.title);
  });

  if (formattingRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formattingRequests } });
  }
}

/** Creates a new spreadsheet with one tab per entry in `tabs`, each tab's own header+rows starting at A1, then applies formatting (frozen/styled header, column widths, severity/status color-coding, resolved checkboxes, tab colors). Returns the sheet's edit URL. Used for a theme's first-ever export — see updateGoogleSheet for re-exports against an already-existing spreadsheet. */
export async function createGoogleSheet(title: string, tabs: SheetTab[]): Promise<{ url: string; spreadsheetId: string }> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new GoogleSheetsNotConnectedError("Google Sheets is not connected. Connect it from Settings first.");
  }
  if (tabs.length === 0) {
    throw new Error("This theme has no findings to export.");
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

  // Matches each tab back to the sheetId Google assigned it, by title
  // (created in the same order as `tabs`, but matching by title rather
  // than assuming index order lines up is one less thing that can drift).
  const sheetInfoByTitle = new Map(
    (data.sheets ?? [])
      .filter((sheet) => sheet.properties?.title != null && sheet.properties?.sheetId != null)
      .map((sheet) => [sheet.properties!.title!, { sheetId: sheet.properties!.sheetId!, rangeTitle: sheet.properties!.title! }])
  );
  await writeTabValuesAndFormatting(sheets, spreadsheetId, tabs, sheetInfoByTitle);

  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, spreadsheetId };
}

/** Confirms a theme's stored spreadsheet id is still reachable (the user may have deleted it in Drive) and returns its current tabs — doubles as the reachability check and the tab inventory updateGoogleSheet needs for its delete+recreate step. */
export async function getSpreadsheetSheetsList(spreadsheetId: string): Promise<SpreadsheetSheetInfo[]> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new GoogleSheetsNotConnectedError("Google Sheets is not connected. Connect it from Settings first.");
  }
  const sheets = google.sheets({ version: "v4", auth: client });
  try {
    const { data } = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
    return (data.sheets ?? [])
      .map((s) => ({ sheetId: s.properties?.sheetId, title: s.properties?.title }))
      .filter((s): s is SpreadsheetSheetInfo => s.sheetId != null && s.title != null);
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 404 || code === 403) {
      throw new GoogleSheetSpreadsheetNotFoundError("The previously connected Google Sheet is no longer accessible.");
    }
    throw err;
  }
}

/** Reads back each tab's already-written data rows (skipping the header), for lib/export/checklistMerge.ts to reconcile against a fresh export. Tabs that don't exist yet on the spreadsheet (a brand-new category) simply come back with no rows. */
export async function readExistingChecklistRows(spreadsheetId: string, tabTitles: string[]): Promise<Record<string, string[][]>> {
  if (tabTitles.length === 0) return {};
  const client = await getAuthorizedClient();
  if (!client) {
    throw new GoogleSheetsNotConnectedError("Google Sheets is not connected. Connect it from Settings first.");
  }
  const sheets = google.sheets({ version: "v4", auth: client });
  const lastColumn = columnLetter(TAB_COLUMNS.length - 1);
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabTitles.map((title) => `'${sanitizeTabTitle(title)}'!A2:${lastColumn}`),
  });

  const rowsByTitle: Record<string, string[][]> = {};
  (data.valueRanges ?? []).forEach((range, index) => {
    rowsByTitle[tabTitles[index]] = (range.values as string[][] | undefined) ?? [];
  });
  return rowsByTitle;
}

function tempTitleFor(title: string): string {
  return `${sanitizeTabTitle(title)} (updating)`.slice(0, 100);
}

/**
 * The update counterpart to createGoogleSheet, for a theme's
 * already-existing spreadsheet. buildSheetFormattingRequests uses
 * additive Sheets API operations (addConditionalFormatRule, addBanding)
 * that would stack duplicate rules on every re-export if applied to a
 * sheet in place, so each incoming tab's prior sheet (if any) is deleted
 * and a fresh one added in its place within the same spreadsheet, rather
 * than clearing and reformatting — simpler and more correct than trying
 * to diff formatting state.
 *
 * The replacement sheets are added under temporary titles *before* the old
 * ones are deleted, rather than delete-then-add: since every incoming tab
 * is normally replacing an existing tab of the same category, a
 * delete-then-add batch would momentarily try to remove every sheet in
 * the spreadsheet, which the Sheets API rejects outright ("You can't
 * remove all the sheets in a document."). Values/formatting are written
 * into the temporary-titled sheets, then a final batch deletes the old
 * sheets and renames the new ones into place in one atomic call.
 * `existingSheets` is the spreadsheet's current tab list (from
 * getSpreadsheetSheetsList), used to find which of the incoming tabs
 * already have an old sheet to delete.
 */
export async function updateGoogleSheet(
  spreadsheetId: string,
  tabs: SheetTab[],
  existingSheets: SpreadsheetSheetInfo[]
): Promise<{ url: string; spreadsheetId: string }> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new GoogleSheetsNotConnectedError("Google Sheets is not connected. Connect it from Settings first.");
  }
  if (tabs.length === 0) {
    throw new Error("This theme has no findings to export.");
  }

  const sheets = google.sheets({ version: "v4", auth: client });

  const { data: addData } = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: tabs.map((tab) => ({ addSheet: { properties: { title: tempTitleFor(tab.title) } } })) },
  });
  // Google guarantees replies[] is positional with requests[], so pair each
  // reply with its originating tab by index *before* filtering — filtering
  // first would shift indices out of alignment with `tabs`.
  const sheetInfoByTitle = new Map(
    (addData.replies ?? [])
      .map((r, i) => ({ properties: r.addSheet?.properties, tab: tabs[i] }))
      .filter((entry): entry is { properties: sheets_v4.Schema$SheetProperties; tab: SheetTab } => entry.properties?.title != null && entry.properties?.sheetId != null)
      .map(({ properties, tab }) => [sanitizeTabTitle(tab.title), { sheetId: properties.sheetId!, rangeTitle: properties.title! }] as const)
  );

  await writeTabValuesAndFormatting(sheets, spreadsheetId, tabs, sheetInfoByTitle);

  const incomingTitles = new Set(tabs.map((tab) => sanitizeTabTitle(tab.title)));
  const finalizeRequests = [
    ...existingSheets.filter((s) => incomingTitles.has(s.title)).map((s) => ({ deleteSheet: { sheetId: s.sheetId } })),
    ...tabs.map((tab) => ({
      updateSheetProperties: {
        properties: { sheetId: sheetInfoByTitle.get(sanitizeTabTitle(tab.title))!.sheetId, title: sanitizeTabTitle(tab.title) },
        fields: "title",
      },
    })),
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: finalizeRequests } });

  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, spreadsheetId };
}
