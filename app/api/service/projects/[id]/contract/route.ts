import { handle, readBody } from "@/lib/service/api/http";
import { getContract, putContract } from "@/lib/service/api/hours";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => getContract(id));
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => putContract(id, await readBody(request)));
}
