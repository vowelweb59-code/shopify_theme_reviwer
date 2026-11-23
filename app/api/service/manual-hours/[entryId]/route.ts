import { handle, readBody } from "@/lib/service/api/http";
import { allocateManualHours, deleteManualHours } from "@/lib/service/api/manual-hours";

type Ctx = { params: Promise<{ entryId: string }> };

// PATCH { member }: give the hours to a team member (their key), or to nobody (empty). DELETE: remove the entry.
export async function PATCH(request: Request, { params }: Ctx) {
  const { entryId } = await params;
  return handle(async () => allocateManualHours(entryId, await readBody(request)));
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { entryId } = await params;
  return handle(async () => deleteManualHours(entryId));
}
