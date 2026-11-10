import { handle, readBody } from "@/lib/service/api/http";
import { deleteDepartment, updateDepartment } from "@/lib/service/api/departments";

// PUT /api/service/departments/:id { name?, managerUserId? }; DELETE sends its projects to the default department.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => updateDepartment(id, await readBody(request)));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => deleteDepartment(id));
}
