import { connectToDatabase } from "@/lib/db/connect";
import { AuditRun } from "@/models/audit-run";

// Audits run inside the server process (executeAuditRun), so a restart
// mid-audit (a deploy, or the host putting the instance to sleep) leaves
// its AuditRun "running" forever: nothing will ever finish it, and it can't
// resume. Mark such runs failed with a plain reason instead.
//   - At boot: this process just started, so nothing can really be running.
//   - Periodically: an audit takes minutes, so one still "running" after
//     STALE_AUDIT_MS was cut off too (e.g. the process crashed without a restart hook).

export const STALE_AUDIT_MS = 2 * 60 * 60 * 1000;
const SWEEP_MS = 30 * 60 * 1000;
export const INTERRUPTED_AUDIT_ERROR = "Interrupted: the server restarted while this audit was running. Run the audit again.";

/** Fails every running audit (`all`, at boot) or those started more than STALE_AUDIT_MS ago. Returns how many. */
export async function failInterruptedAudits(now: Date, { all = false }: { all?: boolean } = {}): Promise<number> {
  const result = await AuditRun.updateMany(
    { status: "running", ...(all ? {} : { startedAt: { $lt: new Date(now.getTime() - STALE_AUDIT_MS) } }) },
    { $set: { status: "failed", completedAt: now, error: INTERRUPTED_AUDIT_ERROR, currentStage: null }, $unset: { stageProgress: "" } }
  );
  return result.modifiedCount;
}

const globalForRecovery = globalThis as typeof globalThis & { _auditRecovery?: { started: boolean } };
const state = (globalForRecovery._auditRecovery ??= { started: false });

/** Called once from instrumentation.ts on server boot. */
export async function startAuditRecovery() {
  if (state.started) return;
  state.started = true;
  await connectToDatabase();
  const failed = await failInterruptedAudits(new Date(), { all: true });
  if (failed) console.log(`[audit-recovery] marked ${failed} interrupted audit run(s) as failed`);
  setInterval(() => {
    void failInterruptedAudits(new Date()).catch((err) => console.error("[audit-recovery] sweep failed:", err instanceof Error ? err.message : err));
  }, SWEEP_MS).unref?.();
}
