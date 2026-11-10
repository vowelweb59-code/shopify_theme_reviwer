import { handle } from "@/lib/service/api/http";
import { runFollowUps } from "@/lib/service/import/persist";
import { rematchClients } from "@/lib/service/import/rematch";

// POST /api/service/chat/reread: re-applies the placement rules without calling Google (match clients by the current names
// and aliases, place entries of multi-project clients, list reporters, 45-day On hold rule).
export async function POST() {
  return handle(async () => {
    const matched = await rematchClients();
    await runFollowUps();
    return { matched };
  });
}
