import { handle } from "@/lib/service/api/http";
import { disconnectChat } from "@/lib/service/api/chat";

export async function POST() {
  return handle(disconnectChat);
}
