import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { typeHasStatus } from "@/lib/projects/constants";
import { parseProjectFields, parseProjectMembers, parseProjectType } from "@/lib/projects/sanitize";
import { rejectionCount } from "@/lib/projects/rounds";
import { resolveMembers, resolveRounds } from "@/lib/projects/resolveMembers";
import { Project } from "@/models/project";
import { Theme } from "@/models/theme";
import { TeamMember } from "@/models/team-member";
import { TimeEntry } from "@/models/time-entry";

/**
 * Every project with its theme's name and assigned members resolved, plus the
 * bare theme list for the "New project" picker — GET /api/themes computes a
 * scoreboard per theme, far too heavy for a dropdown. `totalHours` is the sum
 * of a Theme Update project's time log (0 for any other type).
 */
export async function GET() {
  await connectToDatabase();
  const [projects, themes, members, hours] = await Promise.all([
    Project.find().sort({ createdAt: -1 }).lean(),
    Theme.find().select("name").sort({ name: 1 }).lean(),
    TeamMember.find().select("name designation").lean(),
    TimeEntry.aggregate([{ $group: { _id: "$projectId", totalHours: { $sum: "$hours" } } }]),
  ]);
  const themeName = new Map(themes.map((t) => [String(t._id), t.name as string]));
  const memberById = new Map(members.map((m) => [String(m._id), m]));
  const hoursById = new Map<string, number>(hours.map((h) => [String(h._id), Math.round(h.totalHours * 100) / 100]));

  return NextResponse.json({
    themes,
    projects: projects.map((p) => ({
      ...p,
      // Rows saved before project types existed are all Theme Design & Development.
      type: p.type ?? "theme_development",
      themeName: themeName.get(String(p.themeId)) ?? null,
      totalHours: hoursById.get(String(p._id)) ?? 0,
      members: resolveMembers(p.members, memberById),
      rounds: resolveRounds(p.rounds, memberById),
      rejections: rejectionCount(p),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  if (!isValidObjectId(body.themeId)) return invalidIdResponse("themeId");
  const type = parseProjectType(body.type);
  if (!type.ok) return NextResponse.json({ error: type.error }, { status: 400 });
  const fields = parseProjectFields(body, false);
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (typeHasStatus(type.value)) {
    fields.value.status ??= "planning";
  } else {
    // A Theme Update is continuous: no status, and no design/development phases to time.
    fields.value.status = undefined;
    fields.value.designDays = null;
    fields.value.developmentDays = null;
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

  const project = await Project.create({ ...fields.value, type: type.value, themeId: body.themeId, members: members.filter((m) => existing.has(m.memberId)) });
  return NextResponse.json({ project }, { status: 201 });
}
