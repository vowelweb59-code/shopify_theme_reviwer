import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { parseTeamMemberInput } from "@/lib/projects/sanitize";
import { countOutcomes, countRejections } from "@/lib/projects/rounds";
import { ChatReport } from "@/models/chat-report";
import { TeamMember } from "@/models/team-member";
import { Theme } from "@/models/theme";
import { Project } from "@/models/project";

export async function GET() {
  await connectToDatabase();
  const [members, counts, projects] = await Promise.all([
    TeamMember.find().sort({ name: 1 }).lean(),
    Project.aggregate([{ $unwind: "$members" }, { $group: { _id: "$members.memberId", projectCount: { $sum: 1 } } }]),
    Project.find().select("name themeId status rejectionStage members rounds").lean(),
  ]);
  const countById = new Map<string, number>(counts.map((c) => [String(c._id), c.projectCount]));
  const rejectionsById = countRejections(projects);
  // Who reported time on which theme: for a theme still in development, only they count on its current round (see countOutcomes).
  // A theme that is live on the Shopify Theme Store (it has a rank in the daily Theme Store ranking crawl) was built before the
  // reports began, and its reports are updates, so it counts everyone listed on its rounds.
  const [reported, liveThemes] = await Promise.all([
    ChatReport.find({ status: "ok", memberId: { $ne: null }, themeId: { $ne: null } }).select("themeId memberId").lean(),
    Theme.find({ themeStoreRank: { $ne: null } }).select("_id").lean(),
  ]);
  const live = new Set(liveThemes.map((t) => String(t._id)));
  const worked = { themesWithReports: new Set<string>(), byTheme: new Map<string, Set<string>>() };
  for (const r of reported) {
    const theme = String(r.themeId);
    if (live.has(theme)) continue;
    worked.themesWithReports.add(theme);
    worked.byTheme.set(theme, (worked.byTheme.get(theme) ?? new Set<string>()).add(String(r.memberId)));
  }
  const outcomesById = countOutcomes(projects, new Map(members.map((m) => [String(m._id), m.designation as string])), worked);
  return NextResponse.json({
    members: members.map((m) => ({ ...m, projectCount: countById.get(String(m._id)) ?? 0, rejectionCount: rejectionsById.get(String(m._id)) ?? 0, approvedCount: outcomesById.get(String(m._id))?.approved ?? 0, decidedRejectedCount: outcomesById.get(String(m._id))?.rejected ?? 0, approvedIn: outcomesById.get(String(m._id))?.approvedIn ?? [], rejectedIn: outcomesById.get(String(m._id))?.rejectedIn ?? [] })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  const parsed = parseTeamMemberInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectToDatabase();
  try {
    const member = await TeamMember.create(parsed.value);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return NextResponse.json({ error: "A team member with that email already exists." }, { status: 409 });
    throw err;
  }
}
