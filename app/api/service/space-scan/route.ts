import { handle } from "@/lib/service/api/http";
import { lastSpaceScan, scanSpace } from "@/lib/service/chat/space-scan";

export const dynamic = "force-dynamic";

// Temporary Space scan tab: GET returns the last scan kept in memory (or null), POST reads the whole space again.
export async function GET() {
  return handle(async () => ({ result: lastSpaceScan() }));
}

export async function POST() {
  return handle(async () => ({ result: await scanSpace() }));
}
