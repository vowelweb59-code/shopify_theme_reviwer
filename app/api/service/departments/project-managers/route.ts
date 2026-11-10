import { handle, readBody } from "@/lib/service/api/http";
import { setProjectManagers } from "@/lib/service/api/departments";

// POST /api/service/departments/project-managers { projectIds, userId, action: "add" | "remove" }
export async function POST(request: Request) {
  return handle(async () => setProjectManagers(await readBody(request)));
}
