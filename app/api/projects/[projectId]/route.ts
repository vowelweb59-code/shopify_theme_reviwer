import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { typeHasStatus } from "@/lib/projects/constants";
import { parseProjectFields, parseProjectMembers } from "@/lib/projects/sanitize";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";

/** One project with its theme, resolved members, and the full team directory for the "add member" picker. */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();

  const project = await Project.findById(projectId).lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const [theme, team] = await Promise.all([
    Theme.findById(project.themeId).select("name").lean(),
    TeamMember.find().select("name designation email").sort({ name: 1 }).lean(),
  ]);
  const teamById = new Map(team.map((m) => [String(m._id), m]));

  return NextResponse.json({
    project: {
      ...project,
      type: project.type ?? "theme_development",
      members: project.members.flatMap((pm: { memberId: unknown; role: string | null }) => {
        const m = teamById.get(String(pm.memberId));
        return m ? [{ memberId: String(m._id), name: m.name, designation: m.designation, role: pm.role }] : [];
      }),
    },
    theme,
    team,
  });
}

/** Partial update: any of name/description/status/designDays/developmentDays and/or the whole `members` list. The theme can't be changed. */
export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });

  const fields = parseProjectFields(body, true);
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });
  const update: Record<string, unknown> = { ...fields.value };

  await connectToDatabase();
  const project = await Project.findById(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // A Theme Update has no status or design/development phases (it tracks hours instead).
  if (!typeHasStatus(project.type)) {
    delete update.status;
    delete update.designDays;
    delete update.developmentDays;
  }

  if ("members" in body) {
    const members = parseProjectMembers(body.members);
    if (!members.ok) return NextResponse.json({ error: members.error }, { status: 400 });
    const existing = new Set((await TeamMember.find({ _id: { $in: members.value.map((m) => m.memberId) } }).select("_id").lean()).map((m) => String(m._id)));
    update.members = members.value.filter((m) => existing.has(m.memberId));
  }

  project.set(update);
  await project.save();
  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();
  const project = await Project.findByIdAndDelete(projectId).lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  await TimeEntry.deleteMany({ projectId });
  return NextResponse.json({ ok: true });
}
