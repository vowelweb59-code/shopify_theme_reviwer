import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { isValidObjectId, invalidIdResponse } from "@/lib/api/validation";
import { buildFindingsSheetRows } from "@/lib/export/sheetRows";
import { createGoogleSheet, GoogleSheetsNotConnectedError } from "@/lib/google/sheetsExport";
// Registers the "Theme" model with Mongoose — required for the populate()
// below; see app/api/reports/route.ts for why this matters.
import "@/models/theme";

// POST (not GET) — this creates a new spreadsheet in the user's Google
// account every call, an irreversible-ish side effect unlike the other
// (idempotent, download-only) export formats.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  if (!isValidObjectId(id)) return invalidIdResponse("Audit run id");

  const auditRun = await AuditRun.findById(id).populate("themeId", "name").lean();
  if (!auditRun) return NextResponse.json({ error: "Audit run not found." }, { status: 404 });

  const findings = await Finding.find({ auditRunId: id }).sort({ severity: 1, filePath: 1 }).lean();
  const themeName =
    auditRun.themeId && typeof auditRun.themeId === "object" && "name" in auditRun.themeId
      ? String(auditRun.themeId.name)
      : "Unknown theme";

  const rows = buildFindingsSheetRows(id, themeName, findings);
  const title = `${themeName} audit — ${new Date(auditRun.startedAt).toLocaleDateString()}`;

  try {
    const { url } = await createGoogleSheet(title, rows);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof GoogleSheetsNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: `Failed to create the Google Sheet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
