import { handle } from "@/lib/service/api/http";
import { teamsReport } from "@/lib/service/api/reports";

// GET /api/service/reports/teams?from=&to=
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return handle(() => teamsReport({ from: q.get("from"), to: q.get("to") }));
}
