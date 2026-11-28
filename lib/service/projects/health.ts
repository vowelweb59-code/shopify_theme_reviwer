// "Going in the incorrect direction" (owner, 2026-11-28): the numeric half of a project's red flag. The chat half is judged by Claude Code from the
// project's Chat space (lib/service/import/space-review.ts `health`). Thresholds are my choice, change on request. Pure.

export interface HealthNumbers {
  status: string;
  kind: "hourly" | "fixed" | "unset";
  /** The current weekly limit of an hourly contract, in minutes. */
  weeklyLimitMinutes: number | null;
  /** Fixed price without an hourly rate: the workable minutes (price / $15 an hour). A fixed project billed by the hours has no cap, so null. */
  workableMinutes: number | null;
  /** All-time minutes reported on the project, by everyone. */
  totalMinutes: number;
  /** Minutes reported in the CURRENT week so far, then in each earlier week, newest first (index 0 = this week, 1 = last week, ...). */
  weekMinutes: number[];
  /** IST date of the newest report by anyone, or null. */
  lastReportDay: string | null;
  today: string;
}

export interface HealthReason {
  kind: "chat" | "numbers";
  text: string;
  threads?: string | null;
}

export const OVER_LIMIT_TOLERANCE = 1.1; // a few minutes over the weekly limit is not "going the wrong way": more than 10% over is
export const SILENT_DAYS = 10; // no report at all for this long on a project that is still running
export const FALLING_RATIO = 0.4; // last two full weeks below this share of the four weeks before them
export const FALLING_MIN_USUAL_MINUTES = 6 * 60; // ... but only when the usual week was at least this much

const h = (m: number) => `${Math.round((m / 60) * 10) / 10} h`;
const RUNNING = new Set(["ACTIVE", "BLOCKED", "PARTIAL_HOLD"]);

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** The numbers that say a RUNNING project is off course; an on-hold or closed project has none (they only carry the chat flag). */
export function numberReasons(p: HealthNumbers): HealthReason[] {
  if (!RUNNING.has(p.status)) return [];
  const out: HealthReason[] = [];
  const week = p.weekMinutes[0] ?? 0;

  if (p.kind === "hourly" && p.weeklyLimitMinutes && p.weeklyLimitMinutes > 0 && week > p.weeklyLimitMinutes * OVER_LIMIT_TOLERANCE) {
    out.push({ kind: "numbers", text: `Over the weekly limit: ${h(week)} reported this week against ${h(p.weeklyLimitMinutes)}.` });
  }
  if (p.kind === "fixed" && p.workableMinutes && p.totalMinutes > p.workableMinutes) {
    out.push({ kind: "numbers", text: `Fixed budget used up: ${h(p.totalMinutes)} worked of ${h(p.workableMinutes)} the price covers.` });
  }

  // Hours falling away: the last two FULL weeks (this week is still running) against the four before them.
  const recent = ((p.weekMinutes[1] ?? 0) + (p.weekMinutes[2] ?? 0)) / 2;
  const usual = (p.weekMinutes.slice(3, 7).reduce((a, b) => a + b, 0) || 0) / 4;
  if (usual >= FALLING_MIN_USUAL_MINUTES && recent < usual * FALLING_RATIO) {
    out.push({ kind: "numbers", text: `Hours are falling: about ${h(recent)} a week lately against ${h(usual)} before.` });
  }

  if (p.lastReportDay) {
    const quiet = daysBetween(p.lastReportDay, p.today);
    if (quiet >= SILENT_DAYS) out.push({ kind: "numbers", text: `No report for ${quiet} days (last ${p.lastReportDay}).` });
  }
  return out;
}

export type ChatHealth = { level: "ok" | "watch" | "red"; reasons: Array<{ text: string; threads?: string | null }> };

export interface ProjectHealth {
  red: boolean;
  /** A milder chat concern ("watch"): shown, not red. */
  watch: boolean;
  reasons: HealthReason[];
}

/** One project's flag: red when ANY chat space of it is judged red or ANY numeric signal fires. */
export function combineHealth(chat: readonly ChatHealth[], numbers: readonly HealthReason[]): ProjectHealth {
  const reasons: HealthReason[] = [
    ...chat.filter((c) => c.level !== "ok").flatMap((c) => c.reasons.map((r) => ({ kind: "chat" as const, text: r.text, threads: r.threads ?? null }))),
    ...numbers,
  ];
  return { red: numbers.length > 0 || chat.some((c) => c.level === "red"), watch: chat.some((c) => c.level === "watch"), reasons };
}
