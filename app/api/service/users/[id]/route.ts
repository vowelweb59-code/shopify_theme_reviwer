import { handle, readBody } from "@/lib/service/api/http";
import { updateUser } from "@/lib/service/api/departments";

// PATCH /api/service/users/:id { displayName?, email?, active? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => updateUser(id, await readBody(request)));
}
