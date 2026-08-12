import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { AuditRun } from "@/models/audit-run";

export async function POST(request: Request) {
  await connectToDatabase();

  const body = await request.json().catch(() => ({}));
  const themeName = typeof body.themeName === "string" ? body.themeName.trim() : "";
  const sourceFileName = typeof body.sourceFileName === "string" ? body.sourceFileName : undefined;

  if (!themeName) {
    return NextResponse.json({ error: "themeName is required." }, { status: 400 });
  }

  const theme =
    (await Theme.findOne({ name: themeName })) ??
    (await Theme.create({ name: themeName, sourceFileName }));

  const auditRun = await AuditRun.create({
    themeId: theme._id,
    status: "pending",
    startedAt: new Date(),
  });

  // Theme ZIP parsing (Phase 2) and rule execution (Phase 3) don't exist
  // yet, so there is nothing to actually run — record that honestly rather
  // than pretending the audit executed.
  auditRun.status = "failed";
  auditRun.completedAt = new Date();
  auditRun.error = "Audit execution is not implemented yet — theme parsing lands in Phase 2, rule execution in Phase 3.";
  await auditRun.save();

  return NextResponse.json({ theme, auditRun }, { status: 201 });
}
