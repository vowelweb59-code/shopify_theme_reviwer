import { handle, readBody } from "@/lib/service/api/http";
import { createProject, listProjects } from "@/lib/service/api/projects";

// GET /api/service/projects?status=&q=&department=&ba=&bd=&hours=1 · POST creates a project.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  return handle(() => listProjects({ status: sp.get("status"), q: sp.get("q"), department: sp.get("department"), ba: sp.get("ba"), bd: sp.get("bd"), hours: sp.get("hours") === "1" }));
}

export async function POST(request: Request) {
  return handle(async () => createProject(await readBody(request)), 201);
}
