import { handle } from "@/lib/service/api/http";
import { listSenders } from "@/lib/service/api/review";

export async function GET() {
  return handle(listSenders);
}
