import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { typeHasStatus } from "@/lib/projects/constants";
import { parseTimeEntryInput } from "@/lib/projects/sanitize";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";

const round = (n: number) => Math.round(n * 100) / 100;

/** A Theme Update project's time log, newest day first, with the total and a per-member breakdown. */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();
  if (!(await Project.exists({ _id: projectId }))) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const [entries, members] = await Promise.all([
    TimeEntry.find({ projectId }).sort({ date: -1, createdAt: -1 }).lean(),
    TeamMember.find().select("name designation").lean(),
  ]);
  const memberById = new Map(members.map((m) => [String(m._id), m]));

  const byMember = new Map<string, { memberId: string; name: string; hours: number }>();
  let total = 0;
  const rows = entries.map((e) => {
    const id = String(e.memberId);
    const name = (memberById.get(id)?.name as string | undefined) ?? "Removed member";
    total += e.hours;
    const sum = byMember.get(id) ?? { memberId: id, name, hours: 0 };
    sum.hours += e.hours;
    byMember.set(id, sum);
    return { _id: String(e._id), memberId: id, memberName: name, date: e.date, hours: e.hours, note: e.note ?? "" };
  });

  return NextResponse.json({
    entries: rows,
    totalHours: round(total),
    byMember: [...byMember.values()].map((m) => ({ ...m, hours: round(m.hours) })).sort((a, b) => b.hours - a.hours),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  const parsed = parseTimeEntryInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectToDatabase();
  const project = await Project.findById(projectId).select("type members").lean();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (typeHasStatus(project.type ?? "theme_development")) {
    return NextResponse.json({ error: "Hours are only logged on Theme Update projects." }, { status: 400 });
  }
  if (!project.members.some((m: { memberId: unknown }) => String(m.memberId) === parsed.value.memberId)) {
    return NextResponse.json({ error: "That person isn't on this project's team." }, { status: 400 });
  }

  const entry = await TimeEntry.create({ ...parsed.value, projectId });
  return NextResponse.json({ entry }, { status: 201 });
}
