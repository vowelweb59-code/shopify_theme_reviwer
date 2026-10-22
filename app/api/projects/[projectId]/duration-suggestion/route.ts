import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { suggestDurations } from "@/lib/chat/durations";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";

/**
 * Design / development days suggested from the time reports posted for this
 * project's theme (theme work only, not preset work). It is a suggestion: the
 * project page offers it and nothing is saved until the user applies it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();

  const project = await Project.findById(projectId).select("themeId").lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const reports = await ChatReport.find({ themeId: project.themeId, kind: "theme", status: "ok" }).select("memberId minutes date").lean();
  const members = await TeamMember.find({ _id: { $in: reports.map((r) => r.memberId) } }).select("designation").lean();
  const designation = new Map(members.map((m) => [String(m._id), m.designation as string]));

  const suggestion = suggestDurations(reports.map((r) => ({ minutes: r.minutes, designation: designation.get(String(r.memberId)) ?? null })));
  const dates = reports.map((r) => r.date.getTime());
  return NextResponse.json({
    ...suggestion,
    from: dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : null,
    to: dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null,
  });
}
