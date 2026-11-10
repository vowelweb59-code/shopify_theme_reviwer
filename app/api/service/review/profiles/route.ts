import { handle, readBody } from "@/lib/service/api/http";
import { createProfile, listProfiles } from "@/lib/service/api/review";

export async function GET() {
  return handle(listProfiles);
}

export async function POST(request: Request) {
  return handle(async () => createProfile(await readBody(request)), 201);
}
