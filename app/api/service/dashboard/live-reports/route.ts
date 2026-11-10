import { handle } from "@/lib/service/api/http";
import { liveReports } from "@/lib/service/api/hours";

// GET /api/service/dashboard/live-reports?limit=40
export async function GET(request: Request) {
  return handle(() => liveReports(new URL(request.url).searchParams.get("limit")));
}
