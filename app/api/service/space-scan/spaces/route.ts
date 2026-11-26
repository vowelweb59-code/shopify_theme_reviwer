import { handle } from "@/lib/service/api/http";
import { listLiveProjects } from "@/lib/service/api/live-projects";
import { listServiceSpaces } from "@/lib/service/chat/google";
import { serviceRefreshToken } from "@/lib/service/chat/sync";
import { matchSpacesToProjects } from "@/lib/service/import/space-match";

export const dynamic = "force-dynamic";

// Read-only: the named Chat spaces the connected account is in, matched by name to the active projects (suggestions only, nothing is connected).
// Signed-in users and the export token (lib/auth/exportToken.ts) can read it.
export async function GET() {
  return handle(async () => {
    const [spaces, projects] = await Promise.all([serviceRefreshToken().then(listServiceSpaces), listLiveProjects()]);
    return { spaceCount: spaces.length, matches: matchSpacesToProjects(spaces, projects), spaces };
  });
}
