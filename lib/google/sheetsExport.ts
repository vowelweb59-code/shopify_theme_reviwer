import { google } from "googleapis";
import { getAuthorizedClient } from "./oauth";

export class GoogleSheetsNotConnectedError extends Error {}

/** Creates a new spreadsheet in the connected Google account and writes `rows` starting at A1. Returns the sheet's own edit URL. */
export async function createGoogleSheet(title: string, rows: string[][]): Promise<{ url: string; spreadsheetId: string }> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new GoogleSheetsNotConnectedError("Google Sheets is not connected. Connect it from Settings first.");
  }

  const sheets = google.sheets({ version: "v4", auth: client });
  const { data } = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  const spreadsheetId = data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet id.");

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, spreadsheetId };
}
