// Failed-login throttle. In memory on purpose: the app runs as a single
// Render instance, so one process sees every attempt, and a restart only
// resets the counters (it never locks anyone out for good).
//
// Two limits: per client IP (stops one attacker guessing), and a global one
// well above what the team ever needs (stops guessing spread over many IPs,
// or one attacker forging their IP header). Past the global limit sign-in is
// not closed to everyone for the rest of the window (that would let an
// attacker lock the owner out): one attempt per GLOBAL_SLOT_MS gets through,
// so the owner waits seconds, not minutes, and guessing stays slow.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_GLOBAL = 100;
const GLOBAL_SLOT_MS = 30 * 1000;

type Bucket = { count: number; resetAt: number };

const byIp = new Map<string, Bucket>();
let global: Bucket = { count: 0, resetAt: 0 };
let nextSlotAt = 0;

function current(bucket: Bucket | undefined, now: number): Bucket {
  return bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + WINDOW_MS };
}

/**
 * Seconds until this client may try again, or 0 if it may try now. When the global limit is exceeded, returning 0 also claims
 * the next attempt slot, so call it once per attempt.
 */
export function retryAfterSeconds(ip: string, now = Date.now()): number {
  const ipBucket = current(byIp.get(ip), now);
  global = current(global, now);
  if (ipBucket.count >= MAX_FAILURES_PER_IP) return Math.ceil((ipBucket.resetAt - now) / 1000);
  if (global.count >= MAX_FAILURES_GLOBAL) {
    if (now < nextSlotAt) return Math.ceil((nextSlotAt - now) / 1000);
    nextSlotAt = now + GLOBAL_SLOT_MS;
  }
  return 0;
}

export function recordFailure(ip: string, now = Date.now()): void {
  const ipBucket = current(byIp.get(ip), now);
  ipBucket.count++;
  byIp.set(ip, ipBucket);
  global = current(global, now);
  global.count++;
  // Keep the map from growing without bound under a spray of IPs.
  if (byIp.size > 5000) {
    for (const [key, b] of byIp) if (b.resetAt <= now) byIp.delete(key);
  }
}

export function recordSuccess(ip: string): void {
  byIp.delete(ip);
}

/** Test hook. */
export function resetLoginRateLimit(): void {
  byIp.clear();
  global = { count: 0, resetAt: 0 };
  nextSlotAt = 0;
}

/**
 * The client's IP. By default from the headers Render's edge is expected to set (True-Client-IP / CF-Connecting-IP), else the
 * first x-forwarded-for entry. Those are only as trustworthy as the proxy in front: a client can put anything at the start of
 * x-forwarded-for, so with TRUSTED_PROXY_HOPS=n the address n entries from the END of x-forwarded-for is used instead (each
 * trusted proxy appends the address it saw, so the end is the part a client can't write). The global limit still bounds
 * guessing if the default is forged.
 */
export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  const hops = Number(env.TRUSTED_PROXY_HOPS);
  if (Number.isInteger(hops) && hops > 0) {
    const entries = (headers.get("x-forwarded-for") ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const pick = entries[entries.length - hops];
    if (pick) return pick;
  }
  const direct = headers.get("true-client-ip") ?? headers.get("cf-connecting-ip");
  if (direct) return direct.trim();
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}
