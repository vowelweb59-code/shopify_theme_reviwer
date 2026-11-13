import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { loadDeadlines } from "@/lib/projects/loadDeadlines";

/**
 * One project's deadline state, budget (average working days of finished projects of its type) and extra days, the same numbers the
 * Deadlines page shows. 404 for a Theme Update project, which has no deadline.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isValidObjectId(projectId)) return invalidIdResponse("projectId");
  const { today, benchmarks, projects } = await loadDeadlines();
  const row = projects.find((p) => p._id === projectId);
  if (!row) return NextResponse.json({ error: "This project has no deadline (Theme Update projects are continuous)." }, { status: 404 });
  return NextResponse.json({ today, benchmarks, project: row });
}
