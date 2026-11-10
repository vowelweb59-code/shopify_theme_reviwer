// Appends one hash-chained row to the Service audit log. The app runs as one Node process, so writers are serialised with an
// in-process queue; the unique `seq` index makes a racing second process fail loudly instead of forking the chain.
import { computeHash, GENESIS_HASH } from "./hash-chain";
import { ServiceAuditLog } from "@/models/service-audit-log";

let tail: Promise<void> = Promise.resolve();

export function recordServiceAudit(action: string, detail: Record<string, unknown> = {}): Promise<void> {
  const run = tail.then(async () => {
    const last = await ServiceAuditLog.findOne().sort({ seq: -1 }).select("seq hash").lean<{ seq: number; hash: string } | null>();
    const prevHash = last?.hash ?? GENESIS_HASH;
    const at = new Date();
    // Plain JSON so the stored detail hashes the same when read back.
    const clean = JSON.parse(JSON.stringify(detail)) as Record<string, unknown>;
    const hash = computeHash(prevHash, { actorId: null, action, detail: clean, at: at.toISOString() });
    await ServiceAuditLog.create({ seq: (last?.seq ?? 0) + 1, action, detail: clean, at, prevHash, hash });
  });
  tail = run.catch(() => undefined);
  return run;
}
