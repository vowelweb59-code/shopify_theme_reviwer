import { handle } from "@/lib/service/api/http";
import { projectsReport } from "@/lib/service/api/reports";

// GET /api/service/reports/projects?from=&to=&kind=direct|fixed|timer&all=1
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return handle(() => projectsReport({ from: q.get("from"), to: q.get("to"), kind: q.get("kind"), all: q.get("all") === "1" }));
}
