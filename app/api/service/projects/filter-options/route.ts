import { handle } from "@/lib/service/api/http";
import { filterOptions } from "@/lib/service/api/projects";

export async function GET() {
  return handle(() => filterOptions());
}
