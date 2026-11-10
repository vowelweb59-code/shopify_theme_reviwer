import { handle, readBody } from "@/lib/service/api/http";
import { createClient, listClients } from "@/lib/service/api/review";

export async function GET() {
  return handle(listClients);
}

export async function POST(request: Request) {
  return handle(async () => createClient(await readBody(request)), 201);
}
