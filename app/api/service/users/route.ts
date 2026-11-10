import { handle, readBody } from "@/lib/service/api/http";
import { createUser, listUsers } from "@/lib/service/api/departments";

// GET /api/service/users, POST { displayName, email?, kind? }: the service team's managers directory (not logins).
export async function GET() {
  return handle(() => listUsers());
}

export async function POST(request: Request) {
  return handle(async () => createUser(await readBody(request)), 201);
}
