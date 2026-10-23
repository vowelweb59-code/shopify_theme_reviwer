import { HOURS_PER_DAY } from "@/lib/chat/durations";

// What a project has taken in total: the design and development days that were entered by hand earlier (fixed, never edited
// again) plus what the Theme Status Group time reports add on top, recalculated from the reports every time it is read.
// Designers' hours count as design and developers' as development; Product Managers' hours are not counted. Any other
// non-manager role counts toward the total hours only.
export type TotalsReport = { minutes: number; designation: string | null };
type Fixed = { designDays: number | null; developmentDays: number | null };

/**
 * The share of design in a project's total duration, averaged over the projects that have both numbers entered by hand
 * (sum of design days / sum of all their days). Null when no project has both.
 */
export function designShare(projects: Fixed[]): number | null {
  let design = 0;
  let all = 0;
  for (const p of projects) {
    if (p.designDays === null || p.developmentDays === null) continue;
    design += p.designDays;
    all += p.designDays + p.developmentDays;
  }
  return all > 0 ? design / all : null;
}

/**
 * A project with only one of the two numbers entered has that number as its total duration (the other phase was never
 * recorded separately), so it is split by the average design share. The stored values are never changed; this is only
 * how they are read.
 */
export function resolveFixed(fixed: Fixed, share: number | null): Fixed & { estimated: boolean } {
  const onlyOne = (fixed.designDays === null) !== (fixed.developmentDays === null);
  if (!onlyOne || share === null) return { ...fixed, estimated: false };
  const total = (fixed.designDays ?? fixed.developmentDays) as number;
  return { designDays: round2(total * share), developmentDays: round2(total * (1 - share)), estimated: true };
}
export type Totals = {
  /** Fixed days entered by hand plus days from the space; null when neither has any. */
  designDays: number | null;
  developmentDays: number | null;
  /** The fixed days after any split of a single entered total, and whether they were split that way. */
  fixedDesignDays: number | null;
  fixedDevelopmentDays: number | null;
  estimated: boolean;
  /** Hours read from the space, hours the fixed days stand for (8.5 per day), and both together. */
  spaceHours: number;
  fixedHours: number;
  totalHours: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function projectTotals(entered: Fixed, reports: TotalsReport[], share: number | null = null): Totals {
  const fixed = resolveFixed(entered, share);
  let design = 0;
  let development = 0;
  let all = 0;
  for (const r of reports) {
    if (/manager/i.test(r.designation ?? "")) continue;
    all += r.minutes;
    if (/designer|ui\/ux/i.test(r.designation ?? "")) design += r.minutes;
    else if (/developer/i.test(r.designation ?? "")) development += r.minutes;
  }
  const days = (fixedDays: number | null, minutes: number) => (fixedDays === null && minutes === 0 ? null : round2((fixedDays ?? 0) + minutes / 60 / HOURS_PER_DAY));
  const spaceHours = round2(all / 60);
  const fixedHours = round2(((fixed.designDays ?? 0) + (fixed.developmentDays ?? 0)) * HOURS_PER_DAY);
  return {
    fixedDesignDays: fixed.designDays,
    fixedDevelopmentDays: fixed.developmentDays,
    estimated: fixed.estimated,
    designDays: days(fixed.designDays, design),
    developmentDays: days(fixed.developmentDays, development),
    spaceHours,
    fixedHours,
    totalHours: round2(spaceHours + fixedHours),
  };
}
