import { handle, readBody } from "@/lib/service/api/http";
import { updateClient } from "@/lib/service/api/review";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => updateClient(id, await readBody(request)));
}
