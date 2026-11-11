import "server-only";
import { AdminAudit } from "@/models/admin-audit";

/** Records a destructive action. Never throws: failing to log must not undo or block the action itself. */
export async function recordAdminAudit(action: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await AdminAudit.create({ action, detail });
  } catch (err) {
    console.error("[admin-audit] could not record", action, err instanceof Error ? err.message : err);
  }
}
