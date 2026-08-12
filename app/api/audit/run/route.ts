import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";
import { parseThemeZip, ThemeZipError, InvalidThemeError } from "@/lib/theme-parser";
import { runAuditRules } from "@/lib/audit";

export async function POST(request: Request) {
  await connectToDatabase();

  const formData = await request.formData();
  const themeName = formData.get("themeName")?.toString().trim();
  const file = formData.get("file");

  if (!themeName) {
    return NextResponse.json({ error: "themeName is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A theme ZIP file is required." }, { status: 400 });
  }

  const theme =
    (await Theme.findOne({ name: themeName })) ?? (await Theme.create({ name: themeName }));
  if (theme.sourceFileName !== file.name) {
    theme.sourceFileName = file.name;
    await theme.save();
  }

  const auditRun = await AuditRun.create({
    themeId: theme._id,
    status: "running",
    startedAt: new Date(),
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseThemeZip(buffer);
    const { findings, summary, ruleErrors } = await runAuditRules(result.files);

    if (findings.length > 0) {
      await Finding.insertMany(
        findings.map((f) => ({
          auditRunId: auditRun._id,
          ruleId: f.ruleId,
          requirementId: f.requirementId ?? null,
          filePath: f.filePath,
          lineNumber: f.lineNumber ?? null,
          category: f.category,
          severity: f.severity,
          finding: f.finding,
          recommendation: f.recommendation ?? null,
          sourceReference: f.sourceReference ?? null,
          sourceUrl: f.sourceUrl ?? null,
        }))
      );
    }

    auditRun.status = "complete";
    auditRun.completedAt = new Date();
    auditRun.fileStats = result.fileStats;
    auditRun.skippedFileCount = result.skippedFileCount;
    if (result.fileErrors.length > 0) auditRun.fileErrors = result.fileErrors;
    auditRun.summary = summary;
    if (ruleErrors.length > 0) auditRun.ruleErrors = ruleErrors;
    await auditRun.save();

    return NextResponse.json({ theme, auditRun, findings }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof ThemeZipError || err instanceof InvalidThemeError
        ? err.message
        : `Unexpected error while parsing the theme: ${err instanceof Error ? err.message : String(err)}`;

    auditRun.status = "failed";
    auditRun.completedAt = new Date();
    auditRun.error = message;
    await auditRun.save();

    return NextResponse.json({ theme, auditRun, error: message }, { status: 400 });
  }
}
