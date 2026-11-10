import { handle, readBody } from "@/lib/service/api/http";
import { bulkCreateClients } from "@/lib/service/api/review";

export async function POST(request: Request) {
  return handle(async () => bulkCreateClients(await readBody(request)));
}
