import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { connectToDatabase } from "@/lib/db/connect";
import { HOURS_PER_MONTH } from "@/lib/projects/cost";
import { loadProjectCosts } from "@/lib/projects/loadCosts";
import { Project } from "@/models/project";

/** What this project cost, split by kind of work and by person (lib/projects/loadCosts.ts); the same number the Projects list shows. */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  await connectToDatabase();
  const project = await Project.findById(projectId).select("themeId type designDays developmentDays designDaysBy developmentDaysBy designDaysSplit developmentDaysSplit").lean<{ _id: unknown; themeId: unknown; type?: string | null; designDays?: number | null; developmentDays?: number | null; designDaysBy?: unknown; developmentDaysBy?: unknown; designDaysSplit?: { memberId: unknown; share: number }[]; developmentDaysSplit?: { memberId: unknown; share: number }[] }>();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const cost = (await loadProjectCosts([project])).get(projectId) ?? null;
  return NextResponse.json({ hoursPerMonth: HOURS_PER_MONTH, cost });
}
