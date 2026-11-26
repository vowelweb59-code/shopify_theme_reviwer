import { ServiceError, handle } from "@/lib/service/api/http";
import { listLiveProjects } from "@/lib/service/api/live-projects";
import { listServiceSpaces } from "@/lib/service/chat/google";
import { serviceRefreshToken } from "@/lib/service/chat/sync";
import { matchSpacesToProjects } from "@/lib/service/import/space-match";

export const dynamic = "force-dynamic";

// Read-only: the named Chat spaces the connected account is in, matched by name to the active projects (suggestions only, nothing is connected).
// Signed-in users and the export token (lib/auth/exportToken.ts) can read it.
export async function GET() {
  return handle(async () => {
    let spaces;
    try {
      spaces = await listServiceSpaces(await serviceRefreshToken());
    } catch (err) {
      // Google's own reason (e.g. "403 PERMISSION_DENIED: insufficient authentication scopes") is what the owner needs to see; it holds no secret.
      throw new ServiceError(502, `Could not list Chat spaces: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    const projects = await listLiveProjects();
    return { spaceCount: spaces.length, matches: matchSpacesToProjects(spaces, projects), spaces };
  });
}
