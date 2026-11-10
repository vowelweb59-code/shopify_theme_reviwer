import { handle, readBody } from "@/lib/service/api/http";
import { setSalary } from "@/lib/service/api/team";

// PUT /api/service/team/:senderId/salary { monthly, currency }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => setSalary(id, await readBody(request)));
}
