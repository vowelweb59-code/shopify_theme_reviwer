import { handle } from "@/lib/service/api/http";
import { teamList } from "@/lib/service/api/team";

// GET /api/service/team?week=YYYY-MM-DD
export async function GET(request: Request) {
  return handle(() => teamList(new URL(request.url).searchParams.get("week")));
}
