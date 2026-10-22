import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { MAX_DESCRIPTION, typeHasStatus } from "@/lib/projects/constants";
import { parseProjectFields, parseProjectMembers, parseRounds } from "@/lib/projects/sanitize";
import { rejectionCount } from "@/lib/projects/rounds";
import { resolveMembers, resolveRounds } from "@/lib/projects/resolveMembers";
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
      members: resolveMembers(project.members, teamById),
      rounds: resolveRounds(project.rounds, teamById),
      rejections: rejectionCount(project),
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

  // The earlier rounds as a whole list (edit a note, drop a round), like `members`.
  if ("rounds" in body) {
    if (!typeHasStatus(project.type)) return NextResponse.json({ error: "A Theme Update has no submission rounds." }, { status: 400 });
    const rounds = parseRounds(body.rounds);
    if (!rounds.ok) return NextResponse.json({ error: rounds.error }, { status: 400 });
    const ids = rounds.value.flatMap((r) => r.members.map((m) => m.memberId));
    const existing = new Set((await TeamMember.find({ _id: { $in: ids } }).select("_id").lean()).map((m) => String(m._id)));
    update.rounds = rounds.value.map((r) => ({ ...r, members: r.members.filter((m) => existing.has(m.memberId)) }));
  }

  // Resubmission: the current round (a rejected one) moves into `rounds` with its status, team and days,
  // and a fresh round starts with the same team, back in development.
  if (body.startNewRound === true) {
    if (project.status !== "rejected") return NextResponse.json({ error: "Only a rejected round can be followed by a new one." }, { status: 400 });
    const note = typeof body.rejectionNote === "string" ? body.rejectionNote.trim().slice(0, MAX_DESCRIPTION) : "";
    const closed = {
      status: project.status,
      designDays: project.designDays ?? null,
      developmentDays: project.developmentDays ?? null,
      members: project.members.map((m: { memberId: unknown; role: string | null }) => ({ memberId: m.memberId, role: m.role })),
      note,
    };
    update.rounds = [...((update.rounds as unknown[] | undefined) ?? project.rounds.map((r: { toObject: () => unknown }) => r.toObject())), closed];
    update.status = "under_development";
    update.designDays = null;
    update.developmentDays = null;
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
