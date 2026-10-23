import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { summarizeDays, type DaysReport } from "@/lib/chat/daysWorked";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";

/**
 * Days and hours each team member has put into this project (Product Managers left out): the Google Chat time reports
 * that belong to it, plus, on a Theme Update project, the hours entered by hand in its hours log.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();

  const project = await Project.findById(projectId).select("themeId type").lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // Each project shows its own work only:
  //   a preset project  - the reports linked to it
  //   an Update project - the theme's update reports, plus its hand-entered hours log
  //   the theme itself  - the new-theme reports (presets and updates have their own projects)
  const type = project.type ?? "theme_development";
  const scope = type === "preset_development" ? { projectId } : type === "theme_update" ? { themeId: project.themeId, kind: "update" } : { themeId: project.themeId, kind: "theme" };
  const reports = await ChatReport.find({ ...scope, status: "ok", memberId: { $ne: null } }).select("memberId minutes kind").lean();

  // Hours entered by hand: this Update project's log entries that did not come from the space
  // (the ones that did are already counted from the reports above).
  const manual = type === "theme_update" ? await TimeEntry.find({ projectId, chatReportKey: { $not: { $type: "string" } } }).select("memberId hours").lean() : [];

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
