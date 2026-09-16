import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { Theme } from "@/models/theme";
import { EnhancementPoint } from "@/models/enhancement-point";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { computeFindingsDiff } from "@/lib/audit/diffFindings";
import { buildEnhancementReportForRun, type EnhancementDetectionRecord } from "@/lib/audit/enhancementReport";
import { buildChecklistSheetTabs, type SheetChecklistFinding, type SheetTab } from "@/lib/export/sheetRows";
import { buildFutureUpdatesTab, type SheetFutureUpdatesPoint } from "@/lib/export/enhancementSheetRows";
import { mergeChecklistRows } from "@/lib/export/checklistMerge";
import { withFutureUpdatesFormatting } from "@/lib/google/enhancementSheetFormatting";
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

  // Built separately from the checklist tabs above and kept out of the
  // merge/diff logic below entirely: unlike a finding, an enhancement
  // point's `status` already lives in the database as the single source
  // of truth, so this tab is always a full rewrite of current state, the
  // same "no reconciliation against last export" contract the standalone
  // /enhancements sheet export uses — never "resolved"/carried-forward
  // like a checklist row.
  const enhancementPoints = await EnhancementPoint.find().lean();
  const { points: futureUpdatesPoints } = buildEnhancementReportForRun(
    auditRun.enhancementDetections as EnhancementDetectionRecord[] | undefined,
    enhancementPoints
  );
  const futureUpdatesTab =
    futureUpdatesPoints.length > 0
      ? withFutureUpdatesFormatting(buildFutureUpdatesTab(futureUpdatesPoints as unknown as SheetFutureUpdatesPoint[]))
      : null;

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
      // Google's Sheets API rejects a values.batchGet range outright
      // ("Unable to parse range: '<title>'!A2:M") when it names a tab that
      // doesn't exist on the spreadsheet at all — unlike an empty range on
      // a tab that does exist, which just comes back with no rows. A tab
      // can be brand new here whenever a category is added after a theme's
      // spreadsheet was first created (e.g. the "Performance" category) or
      // this is simply the first run to produce any finding in it — so only
      // ask for tabs that already exist; anything else has no prior rows to
      // merge forward by definition.
      const existingTitles = new Set(existingSheets.map((s) => s.title));
      const existingRowsByTitle = await readExistingChecklistRows(
        theme.googleSpreadsheetId,
        freshTabs.map((tab) => tab.title).filter((title) => existingTitles.has(title))
      );
      tabsToWrite = freshTabs.map((tab) => ({
        title: tab.title,
        rows: [tab.rows[0], ...mergeChecklistRows(existingRowsByTitle[tab.title] ?? [], tab.rows.slice(1), tab.title)],
      }));
      reused = true;
    }
  }

  // Appended after the merge step above, never through it — see this
  // tab's own construction comment for why.
  if (futureUpdatesTab) tabsToWrite = [...tabsToWrite, futureUpdatesTab];

  if (tabsToWrite.length === 0) {
    return NextResponse.json({ error: "This theme has no findings or enhancement points to export." }, { status: 400 });
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
