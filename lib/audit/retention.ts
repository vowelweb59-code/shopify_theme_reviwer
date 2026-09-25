import { AuditRun } from "@/models/audit-run";
import { Finding } from "@/models/finding";

// Audit-run retention: only each theme's most recent complete audits are
// kept, with their findings. Older ones are what made findings the bulk of
// the database (a theme re-audited 15 times kept 15 full copies), and the
// app only ever compares a run with recent ones — the diff baseline, the
// Sheets checklist merge, and "persistent"/"reintroduced" history.
//
// Trade-off, by decision (2026-09-25): comparisons against older audits,
// and "reintroduced" detection, only reach back this many runs.
export const AUDIT_RUNS_KEPT_PER_THEME = 3;

/**
 * Deletes a theme's complete runs beyond the newest `keep`, and failed runs
 * older than the oldest kept one (a recent failure stays visible). Never
 * touches pending/running runs. Theme ZIPs are untouched: they belong to
 * versions, and re-auditing needs them. Returns what was removed.
 */
export async function pruneOldAuditRuns(themeId: unknown, keep: number = AUDIT_RUNS_KEPT_PER_THEME): Promise<{ runs: number; findings: number }> {
  const complete = await AuditRun.find({ themeId, status: "complete" }).sort({ startedAt: -1 }).select("_id startedAt").lean<{ _id: unknown; startedAt: Date }[]>();
  if (complete.length <= keep) return { runs: 0, findings: 0 };

  const oldestKept = complete[keep - 1].startedAt;
  const staleFailed = await AuditRun.find({ themeId, status: "failed", startedAt: { $lt: oldestKept } }).select("_id").lean<{ _id: unknown }[]>();
  const ids = [...complete.slice(keep).map((r) => r._id), ...staleFailed.map((r) => r._id)];

  const { deletedCount: findings } = await Finding.deleteMany({ auditRunId: { $in: ids } });
  const { deletedCount: runs } = await AuditRun.deleteMany({ _id: { $in: ids } });
  return { runs, findings };
}
