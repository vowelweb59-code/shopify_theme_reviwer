import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { summarizeDays } from "@/lib/chat/daysWorked";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";

/** Days each team member has worked on this project's theme, from the Google Chat time reports (Product Managers left out). */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();

  const project = await Project.findById(projectId).select("themeId").lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const reports = await ChatReport.find({ themeId: project.themeId, status: "ok", memberId: { $ne: null } }).select("memberId minutes kind").lean();
  const members = await TeamMember.find({ _id: { $in: reports.map((r) => r.memberId) } }).select("name designation").lean();
  const byId = new Map(members.map((m) => [String(m._id), m]));

  const rows = summarizeDays(
    reports.flatMap((r) => {
      const m = byId.get(String(r.memberId));
      return m ? [{ memberId: String(r.memberId), minutes: r.minutes, kind: r.kind ?? null, name: m.name as string, designation: m.designation as string }] : [];
    })
  );
  return NextResponse.json({ rows });
}
