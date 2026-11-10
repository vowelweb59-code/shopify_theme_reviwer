import { handle } from "@/lib/service/api/http";
import { getDetails } from "@/lib/service/api/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => getDetails(id));
}
