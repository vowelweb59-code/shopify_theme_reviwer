import { handle, readBody } from "@/lib/service/api/http";
import { getAssignments, setAssignments } from "@/lib/service/api/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => getAssignments(id));
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => setAssignments(id, await readBody(request)));
}
