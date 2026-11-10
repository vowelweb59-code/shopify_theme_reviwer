import { handle } from "@/lib/service/api/http";
import { projectWeek } from "@/lib/service/api/hours";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => projectWeek(id, new URL(request.url).searchParams.get("week")));
}
