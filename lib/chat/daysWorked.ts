import { HOURS_PER_DAY } from "./durations";

// Days and hours each team member has put into a theme: the time reports from the Theme Status Group, plus the hours
// entered by hand in a Theme Update project's hours log (those are update work, so they count under "update").
// Product Managers are left out: their reports are not hands-on build time.
export type DaysReport = {
  memberId: string;
  minutes: number;
  kind: "theme" | "preset" | "update" | null;
  name: string;
  designation: string;
  /** Entered by hand in an hours log, not read from the space. */
  manual?: boolean;
};
export type DaysRow = {
  memberId: string;
  name: string;
  designation: string;
  /** Days on the theme itself (design and development). */
  theme: number;
  /** Days on presets. */
  preset: number;
  /** Days on theme updates, space reports and hand-entered hours together. */
  update: number;
  total: number;
  /** Hours read from the space, hours entered by hand, and both together. */
  spaceHours: number;
  manualHours: number;
  totalHours: number;
};

const toDays = (minutes: number) => Math.round((minutes / 60 / HOURS_PER_DAY) * 100) / 100;
const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
const isManager = (designation: string) => /manager/i.test(designation);

export function summarizeDays(reports: DaysReport[]): DaysRow[] {
  const byMember = new Map<string, { name: string; designation: string; theme: number; preset: number; update: number; space: number; manual: number }>();
  for (const r of reports) {
    if (isManager(r.designation) || r.kind === null) continue;
    const row = byMember.get(r.memberId) ?? { name: r.name, designation: r.designation, theme: 0, preset: 0, update: 0, space: 0, manual: 0 };
    row[r.kind] += r.minutes;
    row[r.manual ? "manual" : "space"] += r.minutes;
    byMember.set(r.memberId, row);
  }
  return [...byMember.entries()]
    .map(([memberId, r]) => ({
      memberId,
      name: r.name,
      designation: r.designation,
      theme: toDays(r.theme),
      preset: toDays(r.preset),
      update: toDays(r.update),
      total: toDays(r.theme + r.preset + r.update),
      spaceHours: toHours(r.space),
      manualHours: toHours(r.manual),
      totalHours: toHours(r.space + r.manual),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
