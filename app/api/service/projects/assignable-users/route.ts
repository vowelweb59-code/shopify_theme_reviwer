import { handle } from "@/lib/service/api/http";
import { assignableUsers } from "@/lib/service/api/projects";

export async function GET() {
  return handle(() => assignableUsers());
}
