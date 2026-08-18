import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { Theme } from "@/models/theme";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { computeFindingsDiff } from "@/lib/audit/diffFindings";
import { buildChecklistSheetTabs, type SheetChecklistFinding, type SheetTab } from "@/lib/export/sheetRows";
import { mergeChecklistRows } from "@/lib/export/checklistMerge";
import {
  createGoogleSheet,
  updateGoogleSheet,
  getSpreadsheetSheetsList,
  readExistingChecklistRows,
  GoogleSheetsNotConnectedError,
  GoogleSheetSpreadsheetNotFoundError,
  type SpreadsheetSheetInfo,
} from "@/lib/google/sheetsExport";

// POST (not GET) — modifies the theme's persistent Google Sheet: creates
// it on the theme's first export, updates the same spreadsheet in place
// on every export after that (see lib/google/sheetsExport.ts's
// updateGoogleSheet), an irreversible-ish side effect unlike the other
// (idempotent, download-only) export formats.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Audit run id");

  const auditRun = await AuditRun.findById(id).lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const theme = await Theme.findById(auditRun.themeId);
  if (!theme) return NextResponse.json({ error: "Theme not found." }, { status: 404 });

  const currentFindings = (await Finding.find({ auditRunId: id })
    .sort({ severity: 1, filePath: 1 })
    .lean()) as unknown as SheetChecklistFinding[];

  // Auto-selected baseline (no manual picking, unlike the on-screen diff
  // section) — the immediately preceding completed run of the same theme,
  // same query shape as loadThemeFindingHistory in
  // app/api/audit/run/route.ts. Empty when this is the theme's first
  // audit; computeFindingsDiff handles that the same way as any other
  // baseline (everything reports as "new"), so there's no special case.
  const baselineRuns = await AuditRun.find({ themeId: theme._id, status: "complete", _id: { $ne: id } })
    .sort({ startedAt: -1 })
    .limit(1)
    .lean();
  const baselineFindings =
    baselineRuns.length > 0
      ? ((await Finding.find({ auditRunId: baselineRuns[0]._id }).lean()) as unknown as SheetChecklistFinding[])
      : [];

  const diff = computeFindingsDiff<SheetChecklistFinding>(baselineFindings, currentFindings);
  const freshTabs = buildChecklistSheetTabs(id, theme.name, diff.findings);

  let tabsToWrite: SheetTab[] = freshTabs;
  let reused = false;
  let existingSheets: SpreadsheetSheetInfo[] | null = null;

  if (theme.googleSpreadsheetId) {
    try {
      existingSheets = await getSpreadsheetSheetsList(theme.googleSpreadsheetId);
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

    if (existingSheets) {
      const existingRowsByTitle = await readExistingChecklistRows(
        theme.googleSpreadsheetId,
        freshTabs.map((tab) => tab.title)
      );
      tabsToWrite = freshTabs.map((tab) => ({
        title: tab.title,
        rows: [tab.rows[0], ...mergeChecklistRows(existingRowsByTitle[tab.title] ?? [], tab.rows.slice(1), tab.title)],
      }));
      reused = true;
    }
  }

  if (tabsToWrite.length === 0) {
    return NextResponse.json({ error: "This theme has no findings to export." }, { status: 400 });
  }

  const recreated = Boolean(theme.googleSpreadsheetId) && !reused;
  const title = `${theme.name} — Audit Checklist`;

  try {
    const result =
      reused && theme.googleSpreadsheetId && existingSheets
        ? await updateGoogleSheet(theme.googleSpreadsheetId, tabsToWrite, existingSheets)
        : await createGoogleSheet(title, tabsToWrite);

    theme.googleSpreadsheetId = result.spreadsheetId;
    theme.googleSheetUrl = result.url;
    await theme.save();

    return NextResponse.json({ url: theme.googleSheetUrl, reused, recreated });
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
