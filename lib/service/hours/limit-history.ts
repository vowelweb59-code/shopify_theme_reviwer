// Weekly limit over time (owner, 2026-11-17: clients change their hourly limit as their work changes). A limit CORRECTION edits the
// value in force; a SCOPE change adds a dated step, and a week uses the step in force on its last day (so the week that contains the
// date already uses the new limit). Pure.
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
