/**
 * Reads a "run every N minutes" setting. An empty value, a typo (NaN), zero or a negative number would make the
 * scheduler's setTimeout fire back to back and hammer Google and Mongo, so anything unusable falls back to the default
 * and anything below `min` is raised to it. Returns milliseconds.
 */
export function intervalMs(raw: string | undefined, defaultMinutes: number, minMinutes = 1): number {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  const minutes = Number.isFinite(n) && n > 0 ? n : defaultMinutes;
  return Math.max(minutes, minMinutes) * 60 * 1000;
}
