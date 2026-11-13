import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { isAutoAuditRunning, startAutoAuditNow } from "@/lib/themes/autoAudit";

/** Whether a Git audit is running right now (the button polls this). */
export async function GET() {
  return NextResponse.json({ running: await isAutoAuditRunning() });
}

/**
 * "Pull from Git and audit now": starts the theme's automatic audit immediately (uses the SAVED repository URL and branch).
 * Answers as soon as it has started; the audit itself takes several minutes. 409 while another Git audit is running.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  const result = await startAutoAuditNow(themeId);
  if (result.started) return NextResponse.json({ ok: true }, { status: 202 });
  if (result.reason === "no-theme") return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  if (result.reason === "no-repo") return NextResponse.json({ error: "Save a repository URL for this theme first." }, { status: 400 });
  return NextResponse.json({ error: "Another Git audit is running. Wait for it to finish, then try again." }, { status: 409 });
}
