import { handle, readBody } from "@/lib/service/api/http";
import { createDepartment, listDepartments } from "@/lib/service/api/departments";

// GET /api/service/departments, POST { name, managerUserId?, isDefault? }
export async function GET() {
  return handle(() => listDepartments());
}

export async function POST(request: Request) {
  return handle(async () => createDepartment(await readBody(request)), 201);
}
