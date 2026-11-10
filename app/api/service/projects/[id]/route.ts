import { handle, readBody } from "@/lib/service/api/http";
import { getProject, patchProject } from "@/lib/service/api/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => getProject(id));
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => patchProject(id, await readBody(request)));
}
