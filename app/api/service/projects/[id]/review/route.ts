import { handle, readBody } from "@/lib/service/api/http";
import { setReview } from "@/lib/service/api/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => setReview(id, await readBody(request)));
}
