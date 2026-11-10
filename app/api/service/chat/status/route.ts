import { handle } from "@/lib/service/api/http";
import { chatStatus } from "@/lib/service/api/chat";

export async function GET() {
  return handle(chatStatus);
}
