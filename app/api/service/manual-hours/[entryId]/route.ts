import { handle, readBody } from "@/lib/service/api/http";
import { deleteManualHours, updateManualHours } from "@/lib/service/api/manual-hours";

type Ctx = { params: Promise<{ entryId: string }> };

// PATCH { date?, hours?, minutes?, note?, member? }: edit the entry; member = a team member's key, or empty for nobody. DELETE: remove the entry.
export async function PATCH(request: Request, { params }: Ctx) {
  const { entryId } = await params;
  return handle(async () => updateManualHours(entryId, await readBody(request)));
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { entryId } = await params;
  return handle(async () => deleteManualHours(entryId));
}
