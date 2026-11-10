import { handle } from "@/lib/service/api/http";
import { departmentsReport } from "@/lib/service/api/reports";

// GET /api/service/reports/departments?from=&to=
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return handle(() => departmentsReport({ from: q.get("from"), to: q.get("to") }));
}
