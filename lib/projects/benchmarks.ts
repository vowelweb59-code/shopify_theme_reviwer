import { HOURS_PER_DAY } from "@/lib/chat/durations";

// Average-based deadlines (owner, 2026-11-13). For each of the two kinds of build work (Theme Design & Development, Preset Design &
// Development) the benchmark is the average working days of the projects that are finished (Live / Completed): total hours of
// everyone but Product Managers (the fixed days entered earlier included, lib/projects/totals.ts) divided by 8.5 h per day. A project
// is then measured against its kind's benchmark: its budget is that average, its deadline is its first report plus the budget in
// working days (Sunday is off), and the days it has used beyond the budget are its extra days.

export const BENCHMARK_TYPES = ["theme_development", "preset_development"] as const;
export type BenchmarkType = (typeof BENCHMARK_TYPES)[number];

export type Benchmark = { days: number; sample: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export const daysFromHours = (hours: number) => round2(hours / HOURS_PER_DAY);

/** Average of the projects that took time (a finished project with no hours says nothing); null when there are none. */
export function averageDays(daysPerProject: number[]): Benchmark | null {
  const took = daysPerProject.filter((d) => d > 0);
  if (took.length === 0) return null;
  return { days: round2(took.reduce((a, b) => a + b, 0) / took.length), sample: took.length };
}

/**
 * The date on which `days` working days (rounded up) have been worked when the first one is `startIso` (YYYY-MM-DD). Sundays don't
 * count; a start on a Sunday begins the next day.
 */
export function addWorkingDays(startIso: string, days: number): string {
  let remaining = Math.max(1, Math.ceil(days));
  const cursor = new Date(`${startIso}T00:00:00Z`);
  for (;;) {
    if (cursor.getUTCDay() !== 0) remaining -= 1;
    if (remaining <= 0) return cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

/** Days used beyond the budget (0 when within it); null when there is no budget to compare with. */
export function extraDays(used: number, budget: number | null): number | null {
  if (budget === null) return null;
  return round2(Math.max(0, used - budget));
}
