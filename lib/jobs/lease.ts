import "server-only";
import { randomUUID } from "node:crypto";
import { JobLease } from "@/models/job-lease";

/**
 * Runs `fn` only if nobody else holds the lease for `key`; returns `{ ran: false }` when someone does. The lease expires
 * after `ttlMs`, so a crashed run can't block the job forever. The in-process `running` flags of the schedulers don't cover a
 * manual run from a button or a second server instance; this does, through Mongo.
 */
export async function withLease<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
  const holder = randomUUID();
  const now = new Date();
  try {
    // Matches only an expired row; a live one makes the upsert collide on _id (E11000) and we back off.
    await JobLease.updateOne({ _id: key, expiresAt: { $lte: now } }, { $set: { holder, expiresAt: new Date(now.getTime() + ttlMs) } }, { upsert: true });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { ran: false };
    throw err;
  }
  try {
    return { ran: true, value: await fn() };
  } finally {
    await JobLease.deleteOne({ _id: key, holder }).catch(() => undefined);
  }
}
