import { handle } from "@/lib/service/api/http";
import { makeDefault } from "@/lib/service/api/departments";

// PUT /api/service/departments/:id/default
export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => makeDefault(id));
}
