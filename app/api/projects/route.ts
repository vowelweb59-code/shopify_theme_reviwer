import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { MAX_NAME, typeHasStatus } from "@/lib/projects/constants";
import { parseProjectFields, parseProjectMembers, parseProjectType } from "@/lib/projects/sanitize";
import { rejectionCount } from "@/lib/projects/rounds";
import { loadProjectTotals } from "@/lib/projects/loadTotals";
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
  const totals = await loadProjectTotals(projects);
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
      // Total hours: a Theme Update project's hours log; any other project the fixed days entered by hand plus the space reports.
      // designTotalDays / developmentTotalDays are the fixed days plus the days the space reports add on top.
      totalHours: totals.get(String(p._id))?.totalHours ?? hoursById.get(String(p._id)) ?? 0,
      spaceHours: totals.get(String(p._id))?.spaceHours ?? 0,
      durationEstimated: totals.get(String(p._id))?.estimated ?? false,
      designTotalDays: totals.get(String(p._id))?.designDays ?? null,
      developmentTotalDays: totals.get(String(p._id))?.developmentDays ?? null,
      members: resolveMembers(p.members, memberById),
      rounds: resolveRounds(p.rounds, memberById),
      rejections: rejectionCount(p),
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  // Either an existing theme, or the name of a new one (created below, reusing a theme of that name if there is one).
  const newThemeName = typeof body.newThemeName === "string" ? body.newThemeName.trim() : "";
  if (newThemeName.length > MAX_NAME) return NextResponse.json({ error: `Theme name must be ${MAX_NAME} characters or fewer.` }, { status: 400 });
  if (!newThemeName && !isValidObjectId(body.themeId)) return invalidIdResponse("themeId");
  const type = parseProjectType(body.type);
  if (!type.ok) return NextResponse.json({ error: type.error }, { status: 400 });
  const fields = parseProjectFields(body, false);
  if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (typeHasStatus(type.value)) {
    fields.value.status ??= "planning";
  } else {
    // A Theme Update is continuous: no status, and no design/development phases to time.
    fields.value.status = undefined;
  }
  // The design and development days entered by hand are fixed history and are never entered or edited again; the space reports add to them.
  fields.value.designDays = null;
  fields.value.developmentDays = null;
  let members: { memberId: string; role: string | null }[] = [];
  if ("members" in body) {
    const parsed = parseProjectMembers(body.members);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    members = parsed.value;
  }

  await connectToDatabase();
  let themeId: unknown = body.themeId;
  if (newThemeName) {
    const escaped = newThemeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const found = await Theme.findOne({ name: new RegExp(`^${escaped}$`, "i") }).select("_id").lean();
    themeId = found?._id ?? (await Theme.create({ name: newThemeName }))._id;
  } else if (!(await Theme.exists({ _id: body.themeId }))) {
    return NextResponse.json({ error: "Theme not found." }, { status: 404 });
  }
  // Ignore ids of members deleted between the page load and this request.
  const existing = new Set((await TeamMember.find({ _id: { $in: members.map((m) => m.memberId) } }).select("_id").lean()).map((m) => String(m._id)));

  const project = await Project.create({ ...fields.value, type: type.value, themeId, members: members.filter((m) => existing.has(m.memberId)) });
  return NextResponse.json({ project }, { status: 201 });
}
