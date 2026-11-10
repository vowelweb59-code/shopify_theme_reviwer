import { handle, notFound, readBody } from "@/lib/service/api/http";
import { approveEntry, assignProject, rejectEntry, resolveTimer } from "@/lib/service/api/review";

const ACTIONS = { approve: approveEntry, reject: rejectEntry, "resolve-timer": resolveTimer, "assign-project": assignProject } as const;

// POST /api/service/review/entries/:id/{approve|reject|resolve-timer|assign-project}
export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  return handle(async () => {
    const fn = ACTIONS[action as keyof typeof ACTIONS];
    if (!fn) throw notFound("Unknown action.");
    return fn(id, await readBody(request));
  });
}
