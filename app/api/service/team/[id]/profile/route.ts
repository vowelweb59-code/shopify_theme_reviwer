import { handle, readBody } from "@/lib/service/api/http";
import { setProfile } from "@/lib/service/api/team";

// PUT /api/service/team/:senderId/profile { designation, team }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => setProfile(id, await readBody(request)));
}
