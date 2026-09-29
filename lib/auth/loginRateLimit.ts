// Failed-login throttle. In memory on purpose: the app runs as a single
// Render instance, so one process sees every attempt, and a restart only
// resets the counters (it never locks anyone out for good).
//
// Two limits: per client IP (stops one attacker guessing), and a global one
// well above what the team ever needs (stops guessing spread over many IPs).

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_GLOBAL = 100;

type Bucket = { count: number; resetAt: number };

const byIp = new Map<string, Bucket>();
let global: Bucket = { count: 0, resetAt: 0 };

function current(bucket: Bucket | undefined, now: number): Bucket {
  return bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + WINDOW_MS };
}

/** Seconds until this client may try again, or 0 if it may try now. */
export function retryAfterSeconds(ip: string, now = Date.now()): number {
  const ipBucket = current(byIp.get(ip), now);
  global = current(global, now);
  if (ipBucket.count >= MAX_FAILURES_PER_IP) return Math.ceil((ipBucket.resetAt - now) / 1000);
  if (global.count >= MAX_FAILURES_GLOBAL) return Math.ceil((global.resetAt - now) / 1000);
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
}

/**
 * The client's IP, from the headers Render's edge sets (True-Client-IP /
 * CF-Connecting-IP), else the first x-forwarded-for entry. A client can
 * forge the x-forwarded-for fallback to dodge its per-IP bucket, which is
 * why the global limit exists.
 */
export function clientIp(headers: Headers): string {
  const direct = headers.get("true-client-ip") ?? headers.get("cf-connecting-ip");
  if (direct) return direct.trim();
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}
