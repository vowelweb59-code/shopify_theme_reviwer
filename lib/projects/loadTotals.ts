import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { designShare, projectTotals, type Totals } from "./totals";

type ProjectLike = { _id: unknown; themeId: unknown; type?: string | null; designDays?: number | null; developmentDays?: number | null };

/**
 * Totals (lib/projects/totals.ts) for projects that have a status: the fixed days entered by hand plus the time reports that
 * belong to them. A theme project counts its theme's new-theme reports; a preset project the preset reports linked to it.
 * A Theme Update project has no design or development days; its hours are its hours log, so it gets no entry here.
 */
export async function loadProjectTotals(projects: ProjectLike[]): Promise<Map<string, Totals>> {
  const reports = await ChatReport.find({ status: "ok", memberId: { $ne: null }, kind: { $in: ["theme", "preset"] } }).select("themeId projectId kind minutes memberId").lean();
  const members = await TeamMember.find({ _id: { $in: [...new Set(reports.map((r) => String(r.memberId)))] } }).select("designation").lean();
  const designation = new Map(members.map((m) => [String(m._id), m.designation as string]));

  const byTheme = new Map<string, { minutes: number; designation: string | null }[]>();
  const byProject = new Map<string, { minutes: number; designation: string | null }[]>();
  for (const r of reports) {
    const row = { minutes: r.minutes as number, designation: designation.get(String(r.memberId)) ?? null };
    if (r.kind === "theme" && r.themeId) byTheme.set(String(r.themeId), [...(byTheme.get(String(r.themeId)) ?? []), row]);
    if (r.kind === "preset" && r.projectId) byProject.set(String(r.projectId), [...(byProject.get(String(r.projectId)) ?? []), row]);
  }

  // The average design share, from every theme project that has both numbers entered by hand; it splits a project that has only a total.
  const complete = await Project.find({ type: { $in: ["theme_development", null] }, designDays: { $ne: null }, developmentDays: { $ne: null } }).select("designDays developmentDays").lean();
  const share = designShare(complete.map((p) => ({ designDays: p.designDays as number, developmentDays: p.developmentDays as number })));

  const out = new Map<string, Totals>();
  for (const p of projects) {
    const type = p.type ?? "theme_development";
    if (type === "theme_update") continue;
    const scoped = type === "preset_development" ? byProject.get(String(p._id)) : byTheme.get(String(p.themeId));
    out.set(String(p._id), projectTotals({ designDays: p.designDays ?? null, developmentDays: p.developmentDays ?? null }, scoped ?? [], share));
  }
  return out;
}
