import { handle } from "@/lib/service/api/http";
import { listReview } from "@/lib/service/api/review";

// GET /api/service/review/entries?flag=&view=unassigned
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  return handle(() => listReview({ flag: sp.get("flag"), view: sp.get("view") }));
}
