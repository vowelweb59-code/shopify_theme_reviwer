import { computeThemeCosts, type HoursInput, type Person } from "./cost";
import { ChatReport } from "@/models/chat-report";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";

type ProjectLike = { _id: unknown; themeId: unknown; type?: string | null };
export type ProjectCost = { cost: number; hours: number; unpricedHours: number };

/**
 * What each project cost (lib/projects/cost.ts prices the hours), scoped like its days and hours are in lib/projects/loadTotals.ts:
 *   Theme Design & Development: the new-theme reports of its theme;
 *   Preset Design & Development: the preset reports linked to it (a preset report not linked to a project is in the theme's cost on
 *     the Theme Cost page, but belongs to no project here);
 *   Theme Update: the update reports of its theme plus the hours entered by hand in its hours log (the entries made from Chat reports
 *     are the same hours as those reports, so they are not added again).
 * Only projects with hours are in the map.
 */
export async function loadProjectCosts(projects: ProjectLike[]): Promise<Map<string, ProjectCost>> {
  const devByTheme = new Map<string, string[]>();
  const updateByTheme = new Map<string, string[]>();
  const updateIds: unknown[] = [];
  for (const p of projects) {
    const theme = String(p.themeId);
    const type = p.type ?? "theme_development";
    if (type === "theme_development") devByTheme.set(theme, [...(devByTheme.get(theme) ?? []), String(p._id)]);
    if (type === "theme_update") {
      updateByTheme.set(theme, [...(updateByTheme.get(theme) ?? []), String(p._id)]);
      updateIds.push(p._id);
    }
  }

  const [members, reports, manual] = await Promise.all([
    TeamMember.find().select("name designation monthlySalary").lean<{ _id: unknown; name: string; designation: string; monthlySalary?: number | null }[]>(),
    ChatReport.find({ status: "ok", memberId: { $ne: null }, kind: { $in: ["theme", "preset", "update"] } })
      .select("themeId projectId memberId kind minutes")
      .lean<{ themeId: unknown; projectId: unknown; memberId: unknown; kind: "theme" | "preset" | "update"; minutes: number }[]>(),
    TimeEntry.find({ projectId: { $in: updateIds }, chatReportKey: { $not: { $type: "string" } } }).select("projectId memberId hours").lean<{ projectId: unknown; memberId: unknown; hours: number }[]>(),
  ]);
  const people = new Map<string, Person>(members.map((m) => [String(m._id), { name: m.name, designation: m.designation, monthlySalary: m.monthlySalary ?? null }]));

  const inputs: HoursInput[] = [];
  for (const r of reports) {
    const hours = r.minutes / 60;
    const memberId = String(r.memberId);
    if (r.kind === "theme" && r.themeId) for (const id of devByTheme.get(String(r.themeId)) ?? []) inputs.push({ themeId: id, memberId, line: "build", hours });
    else if (r.kind === "preset" && r.projectId) inputs.push({ themeId: String(r.projectId), memberId, line: "presets", hours });
    else if (r.kind === "update" && r.themeId) for (const id of updateByTheme.get(String(r.themeId)) ?? []) inputs.push({ themeId: id, memberId, line: "updates", hours });
  }
  for (const e of manual) inputs.push({ themeId: String(e.projectId), memberId: String(e.memberId), line: "updates", hours: e.hours });

  const out = new Map<string, ProjectCost>();
  // computeThemeCosts groups by the key it is given: here the project id.
  for (const [projectId, c] of computeThemeCosts(inputs, people)) out.set(projectId, { cost: c.cost.total, hours: c.hours.total, unpricedHours: c.unpricedHours });
  return out;
}
