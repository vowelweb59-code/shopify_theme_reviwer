import { handle } from "@/lib/service/api/http";
import { dashboardWeek } from "@/lib/service/api/hours";

// GET /api/service/dashboard/weekly-hours?week=YYYY-MM-DD&all=1
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return handle(() => dashboardWeek(q.get("week"), q.get("all") === "1"));
}
