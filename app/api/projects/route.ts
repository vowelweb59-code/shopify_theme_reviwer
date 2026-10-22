import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { datesInOrder, parseProjectFields, parseProjectMembers } from "@/lib/projects/sanitize";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";
import { TeamMember } from "@/models/team-member";

/**
 * Every project with its theme's name and assigned members resolved, plus the
 * bare theme list for the "New project" picker — GET /api/themes computes a
 * scoreboard per theme, far too heavy for a dropdown.
 */
export async function GET() {
  await connectToDatabase();
  const [projects, themes, members] = await Promise.all([
    Project.find().sort({ createdAt: -1 }).lean(),
    Theme.find().select("name").sort({ name: 1 }).lean(),
    TeamMember.find().select("name designation").lean(),
  ]);
  const themeName = new Map(themes.map((t) => [String(t._id), t.name as string]));
  const memberById = new Map(members.map((m) => [String(m._id), m]));

  return NextResponse.json({
    themes,
    projects: projects.map((p) => ({
      ...p,
      themeName: themeName.get(String(p.themeId)) ?? null,
      members: p.members.flatMap((pm: { memberId: unknown; role: string | null }) => {
        const m = memberById.get(String(pm.memberId));
        return m ? [{ memberId: String(m._id), name: m.name, designation: m.designation, role: pm.role }] : [];
      }),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  if (!isValidObjectId(body.themeId)) return invalidIdResponse("themeId");
  const fields = parseProjectFields(body, false);
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (!datesInOrder(fields.value.startDate, fields.value.dueDate)) {
    return NextResponse.json({ error: "Due date can't be before the start date." }, { status: 400 });
  }
  let members: { memberId: string; role: string | null }[] = [];
  if ("members" in body) {
    const parsed = parseProjectMembers(body.members);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    members = parsed.value;
  }

  await connectToDatabase();
  if (!(await Theme.exists({ _id: body.themeId }))) return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  // Ignore ids of members deleted between the page load and this request.
  const existing = new Set((await TeamMember.find({ _id: { $in: members.map((m) => m.memberId) } }).select("_id").lean()).map((m) => String(m._id)));

  const project = await Project.create({ ...fields.value, themeId: body.themeId, members: members.filter((m) => existing.has(m.memberId)) });
  return NextResponse.json({ project }, { status: 201 });
}
