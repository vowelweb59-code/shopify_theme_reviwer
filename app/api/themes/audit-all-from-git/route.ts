import { NextResponse } from "next/server";
import { auditAllProgress, isAutoAuditRunning, startAuditAllNow } from "@/lib/themes/autoAudit";

/** Whether a Git audit is running, and the progress of the "audit all" batch when this server process started it. */
export async function GET() {
  return NextResponse.json({ running: await isAutoAuditRunning(), progress: auditAllProgress() });
}

/**
 * "Audit all themes with a Git repository now": starts every live theme that has a repository, one at a time, and answers as soon
 * as the batch has begun (it takes many minutes). 409 while another Git audit is running; 404 when no theme has a repository.
 */
export async function POST() {
  const result = await startAuditAllNow();
  if (result.started) return NextResponse.json({ ok: true, total: result.total }, { status: 202 });
  if (result.reason === "none") return NextResponse.json({ error: "No live theme has a Git repository saved." }, { status: 404 });
  return NextResponse.json({ error: "Another Git audit is running. Wait for it to finish, then try again." }, { status: 409 });
}
