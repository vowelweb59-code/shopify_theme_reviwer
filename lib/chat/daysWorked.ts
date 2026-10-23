import { HOURS_PER_DAY } from "./durations";

// Days each team member has worked on a theme, from the stored time reports.
// Product Managers are left out: their reports are not hands-on build time.
export type DaysReport = { memberId: string; minutes: number; kind: "theme" | "preset" | "update" | null; name: string; designation: string };
export type DaysRow = {
  memberId: string;
  name: string;
  designation: string;
  /** Days on the theme itself (design and development). */
  theme: number;
  /** Days on presets. */
  preset: number;
  /** Days on theme updates. */
  update: number;
  total: number;
};

const toDays = (minutes: number) => Math.round((minutes / 60 / HOURS_PER_DAY) * 100) / 100;
const isManager = (designation: string) => /manager/i.test(designation);

export function summarizeDays(reports: DaysReport[]): DaysRow[] {
  const byMember = new Map<string, { name: string; designation: string; theme: number; preset: number; update: number }>();
  for (const r of reports) {
    if (isManager(r.designation) || r.kind === null) continue;
    const row = byMember.get(r.memberId) ?? { name: r.name, designation: r.designation, theme: 0, preset: 0, update: 0 };
    row[r.kind] += r.minutes;
    byMember.set(r.memberId, row);
  }
  return [...byMember.entries()]
    .map(([memberId, r]) => ({ memberId, name: r.name, designation: r.designation, theme: toDays(r.theme), preset: toDays(r.preset), update: toDays(r.update), total: toDays(r.theme + r.preset + r.update) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
