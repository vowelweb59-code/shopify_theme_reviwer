import { handle, readBody } from "@/lib/service/api/http";
import { changeStatus } from "@/lib/service/api/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => changeStatus(id, await readBody(request)));
}
