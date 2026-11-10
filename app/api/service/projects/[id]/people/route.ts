import { handle, readBody } from "@/lib/service/api/http";
import { setPeople } from "@/lib/service/api/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => setPeople(id, await readBody(request)));
}
