import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { summarizeDays, type DaysReport } from "@/lib/chat/daysWorked";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";

/**
 * Days and hours each team member has put into this project's theme (Product Managers left out): the Google Chat time
 * reports, plus the hours entered by hand in the theme's Theme Update hours log.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();

  const project = await Project.findById(projectId).select("themeId type").lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // A preset project shows only the reports linked to it (it has no hours log). Any other project shows its theme's own work:
  // preset work is left out, since each preset has its own project and its people are on that page, not on the main theme's.
  const isPreset = project.type === "preset_development";
  const scope = isPreset ? { projectId } : { themeId: project.themeId, kind: { $ne: "preset" } };
  const reports = await ChatReport.find({ ...scope, status: "ok", memberId: { $ne: null } }).select("memberId minutes kind").lean();

  // Hours entered by hand: the theme's Theme Update projects' log entries that did not come from the space
  // (the ones that did are already counted from the reports above).
  const updateProjectIds = isPreset ? [] : (await Project.find({ themeId: project.themeId, type: "theme_update" }).select("_id").lean()).map((p) => p._id);
  const manual = updateProjectIds.length
    ? await TimeEntry.find({ projectId: { $in: updateProjectIds }, chatReportKey: { $not: { $type: "string" } } }).select("memberId hours").lean()
    : [];

  const members = await TeamMember.find({ _id: { $in: [...reports.map((r) => r.memberId), ...manual.map((e) => e.memberId)] } }).select("name designation").lean();
  const byId = new Map(members.map((m) => [String(m._id), m]));

  const rows: DaysReport[] = [
    ...reports.flatMap((r) => {
      const m = byId.get(String(r.memberId));
      return m ? [{ memberId: String(r.memberId), minutes: r.minutes, kind: r.kind ?? null, name: m.name as string, designation: m.designation as string }] : [];
    }),
    ...manual.flatMap((e) => {
      const m = byId.get(String(e.memberId));
      return m ? [{ memberId: String(e.memberId), minutes: e.hours * 60, kind: "update" as const, name: m.name as string, designation: m.designation as string, manual: true }] : [];
    }),
  ];
  return NextResponse.json({ rows: summarizeDays(rows) });
}
