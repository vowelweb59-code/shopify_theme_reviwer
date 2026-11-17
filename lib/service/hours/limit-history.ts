// Weekly limit over time (owner, 2026-11-17: clients change their hourly limit as their work changes). A limit CORRECTION edits the
// value in force; a SCOPE change adds a dated step that starts on a MONDAY the owner chooses (owner, 2026-11-17: it is always from a
// Monday, but which Monday depends on the client). A week uses the step in force on its last day, which for a Monday start is the
// same as on its first. Pure.
export const isMonday = (iso: string): boolean => new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
export type LimitStep = { from: string | null; minutes: number };

/** The limit for a week ending `weekEnd` (YYYY-MM-DD): the latest step starting on or before it, else the contract's current value. */
export function limitForWeek(history: readonly LimitStep[], current: number | null, weekEnd: string): number | null {
  if (!history.length) return current;
  let found: number | null = null;
  for (const s of [...history].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""))) {
    if (s.from === null || s.from <= weekEnd) found = s.minutes;
  }
  return found;
}

/** History after a scope change to `minutes` from `from`: the old value becomes the baseline when there is no history yet. */
export function withScopeChange(history: readonly LimitStep[], previous: number | null, minutes: number, from: string): LimitStep[] {
  const base = history.length ? [...history] : previous !== null ? [{ from: null, minutes: previous }] : [];
  return [...base.filter((s) => s.from !== from), { from, minutes }].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
}

/** History after correcting the value in force today: the latest step takes the new value (no history = nothing to do). */
export function withCorrection(history: readonly LimitStep[], today: string, minutes: number): LimitStep[] {
  if (!history.length) return [];
  const sorted = [...history].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
  let idx = 0;
  sorted.forEach((s, i) => { if (s.from === null || s.from <= today) idx = i; });
  return sorted.map((s, i) => (i === idx ? { ...s, minutes } : s));
}

const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The weekly limit over a period (a week or a month): each Monday-to-Sunday week that touches the period counts its limit in force
 * (`limitForWeek`) times the share of its days inside the period. A whole week gives the plain weekly limit. Null when no limit applies.
 */
export function limitForPeriod(history: readonly LimitStep[], current: number | null, start: string, end: string): number | null {
  let total = 0;
  let any = false;
  const startMs = toMs(start);
  const endMs = toMs(end);
  const dow = (new Date(startMs).getUTCDay() + 6) % 7; // Monday = 0
  for (let ws = startMs - dow * DAY; ws <= endMs; ws += 7 * DAY) {
    const we = ws + 6 * DAY;
    const days = Math.min(we, endMs) / DAY - Math.max(ws, startMs) / DAY + 1;
    const limit = limitForWeek(history, current, toIso(we));
    if (limit !== null) { total += (limit * days) / 7; any = true; }
  }
  return any ? Math.round(total) : null;
}
