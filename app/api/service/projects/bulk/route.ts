import { handle, readBody } from "@/lib/service/api/http";
import { bulkEdit } from "@/lib/service/api/projects";

export async function POST(request: Request) {
  return handle(async () => bulkEdit(await readBody(request)));
}
