import { HOURS_PER_DAY } from "@/lib/chat/durations";

// What a theme cost to make (owner, 2026-11-13). Every hour reported on a theme is priced at the reporter's own hourly cost,
// which comes from their monthly salary: salary / (26 working days x 8.5 h). The hours are the three kinds of work, kept apart so
// build cost shows separately from upkeep:
//   build    new-theme work (Theme Design & Development),
//   presets  preset work,
//   updates  theme-update work: Chat reports and hours entered by hand in a Theme Update hours log.
// Product Managers' hours are included at their own rate. A person with no salary entered has their hours counted but not priced
// (`unpricedHours`). Reports don't record which submission round they belong to, so time spent on a round that was later rejected is
// in the total and cannot be split out as rework.

export const WORKING_DAYS_PER_MONTH = 26;
export const HOURS_PER_MONTH = WORKING_DAYS_PER_MONTH * HOURS_PER_DAY;

export const COST_LINES = ["build", "presets", "updates"] as const;
export type CostLine = (typeof COST_LINES)[number];

/** `month` is the month the hours were worked, "YYYY-MM" (from the report's day). */
/** `day` (YYYY-MM-DD) is needed only to split rework after a first rejection. */
export type HoursInput = { themeId: string; memberId: string; line: CostLine; hours: number; month: string; day?: string };
export type MonthCost = { month: string; cost: number; hours: number };
/** `perLive`: paid per live theme / preset, not by salary, so their hours cost nothing by the hour (and are not "missing a salary"). */
export type Person = { name: string; designation: string; monthlySalary: number | null; perLive?: boolean };
/** A fixed amount (per-live pay, lib/projects/perLive.ts) added to a key's cost; `month` null = no date known. */
export type FixedPayment = { themeId: string; memberId: string; line: CostLine; amount: number; month: string | null };

/** Months key for payments with no date. */
export const UNDATED = "undated";

export type PersonCost = { memberId: string; name: string; designation: string; hours: number; cost: number | null; byLine: Record<CostLine, number>; /** Per-live amounts included in `cost`. */ perLive: number };
export type ThemeCost = {
  cost: Record<CostLine, number> & { total: number };
  hours: Record<CostLine, number> & { total: number };
  /** Hours of people with no salary entered (counted in `hours`, not in `cost`). */
  unpricedHours: number;
  people: PersonCost[];
  /** Cost and hours per month worked, oldest first. */
  byMonth: MonthCost[];
  /**
   * Build work done after the theme's first version was rejected (its first rejection date, entered by hand on the project): the
   * rework. Null when no rejection date is known. Already inside `cost.build`, not on top of it.
   */
  rework: { from: string; cost: number; hours: number } | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const zeroLines = (): Record<CostLine, number> => ({ build: 0, presets: 0, updates: 0 });

/** Cost of one hour of someone's time; null when no salary is entered. */
export function hourlyCost(monthlySalary: number | null | undefined): number | null {
  return monthlySalary === null || monthlySalary === undefined ? null : monthlySalary / HOURS_PER_MONTH;
}

export function computeThemeCosts(inputs: HoursInput[], people: Map<string, Person>, firstRejection: Map<string, string> = new Map(), payments: FixedPayment[] = []): Map<string, ThemeCost> {
  const rework = new Map<string, { cost: number; hours: number }>();
  const raw = new Map<string, { hours: Record<CostLine, number>; cost: Record<CostLine, number>; unpriced: number; months: Map<string, { cost: number; hours: number }>; people: Map<string, { hours: number; cost: number; priced: boolean; perLive: number; byLine: Record<CostLine, number> }> }>();
  const newTheme = () => ({ hours: zeroLines(), cost: zeroLines(), unpriced: 0, months: new Map<string, { cost: number; hours: number }>(), people: new Map<string, { hours: number; cost: number; priced: boolean; perLive: number; byLine: Record<CostLine, number> }>() });
  for (const input of inputs) {
    // A per-live person's hours are priced at 0: their cost is the per-live payments below.
    const rate = people.get(input.memberId)?.perLive ? 0 : hourlyCost(people.get(input.memberId)?.monthlySalary);
    const theme = raw.get(input.themeId) ?? newTheme();
    const month = theme.months.get(input.month) ?? { cost: 0, hours: 0 };
    month.hours += input.hours;
    if (rate !== null) month.cost += input.hours * rate;
    theme.months.set(input.month, month);
    theme.hours[input.line] += input.hours;
    const who = theme.people.get(input.memberId) ?? { hours: 0, cost: 0, priced: rate !== null, perLive: 0, byLine: zeroLines() };
    who.hours += input.hours;
    who.byLine[input.line] += input.hours;
    if (rate === null) theme.unpriced += input.hours;
    else {
      theme.cost[input.line] += input.hours * rate;
      who.cost += input.hours * rate;
    }
    // Rework: build hours worked after the day of the first rejection (that day itself still belongs to the first version).
    const from = firstRejection.get(input.themeId);
    if (from && input.line === "build" && input.day && input.day > from) {
      const r = rework.get(input.themeId) ?? { cost: 0, hours: 0 };
      r.hours += input.hours;
      if (rate !== null) r.cost += input.hours * rate;
      rework.set(input.themeId, r);
    }
    theme.people.set(input.memberId, who);
    raw.set(input.themeId, theme);
  }
  for (const pay of payments) {
    const theme = raw.get(pay.themeId) ?? newTheme();
    theme.cost[pay.line] += pay.amount;
    const monthKey = pay.month ?? UNDATED;
    const month = theme.months.get(monthKey) ?? { cost: 0, hours: 0 };
    month.cost += pay.amount;
    theme.months.set(monthKey, month);
    const who = theme.people.get(pay.memberId) ?? { hours: 0, cost: 0, priced: true, perLive: 0, byLine: zeroLines() };
    who.priced = true;
    who.cost += pay.amount;
    who.perLive += pay.amount;
    theme.people.set(pay.memberId, who);
    raw.set(pay.themeId, theme);
  }

  const out = new Map<string, ThemeCost>();
  for (const [themeId, t] of raw) {
    const cost = { build: Math.round(t.cost.build), presets: Math.round(t.cost.presets), updates: Math.round(t.cost.updates), total: 0 };
    cost.total = cost.build + cost.presets + cost.updates;
    const hours = { build: round1(t.hours.build), presets: round1(t.hours.presets), updates: round1(t.hours.updates), total: round1(t.hours.build + t.hours.presets + t.hours.updates) };
    out.set(themeId, {
      cost,
      hours,
      unpricedHours: round1(t.unpriced),
      rework: firstRejection.has(themeId)
        ? { from: firstRejection.get(themeId) as string, cost: Math.round(rework.get(themeId)?.cost ?? 0), hours: round1(rework.get(themeId)?.hours ?? 0) }
        : null,
      // "undated" (per-live pay of a project with no report) sorts first.
      byMonth: [...t.months.entries()].sort(([a], [b]) => (a === UNDATED ? -1 : b === UNDATED ? 1 : a.localeCompare(b))).map(([month, m]) => ({ month, cost: Math.round(m.cost), hours: round1(m.hours) })),
      people: [...t.people.entries()]
        .map(([memberId, w]) => ({
          memberId,
          name: people.get(memberId)?.name ?? "Removed member",
          designation: people.get(memberId)?.designation ?? "",
          hours: round1(w.hours),
          cost: w.priced ? Math.round(w.cost) : null,
          byLine: { build: round1(w.byLine.build), presets: round1(w.byLine.presets), updates: round1(w.byLine.updates) },
          perLive: Math.round(w.perLive),
        }))
        .sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.hours - a.hours),
    });
  }
  return out;
}
