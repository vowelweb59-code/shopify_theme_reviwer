import { handle } from "@/lib/service/api/http";
import { teamDetail } from "@/lib/service/api/team";

// GET /api/service/team/:senderId?week=YYYY-MM-DD
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => teamDetail(id, new URL(request.url).searchParams.get("week")));
}
