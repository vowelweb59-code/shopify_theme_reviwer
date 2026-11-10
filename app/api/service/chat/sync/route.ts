import { badRequest, handle, readBody } from "@/lib/service/api/http";
import { syncServiceMonth } from "@/lib/service/chat/sync";

// POST /api/service/chat/sync { month: "YYYY-MM" }: imports one IST month of TIMER STATUS. Safe to repeat.
export const maxDuration = 300;

export async function POST(request: Request) {
  return handle(async () => {
    const { month } = await readBody(request);
    if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw badRequest("month must be YYYY-MM");
    try {
      return await syncServiceMonth(month, "manual");
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "The import failed.");
    }
  });
}
