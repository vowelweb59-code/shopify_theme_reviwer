import { handle, readBody } from "@/lib/service/api/http";
import { addManualHours, listManualHours } from "@/lib/service/api/manual-hours";

type Ctx = { params: Promise<{ id: string }> };

// GET: the manual hours of the project. POST: add some ({ hours, minutes, date?, note?, member? }).
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => listManualHours(id));
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => addManualHours(id, await readBody(request)), 201);
}
