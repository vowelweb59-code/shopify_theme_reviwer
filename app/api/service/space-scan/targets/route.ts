import { handle } from "@/lib/service/api/http";
import { listLiveProjects } from "@/lib/service/api/live-projects";
import { loadProjectSpaces } from "@/lib/service/chat/space-scan";

export const dynamic = "force-dynamic";

// Read-only, for the daily Live Project Chat Summary job (signed-in users and the export token can read it): the projects on the Active list
// TODAY (the same list as the tabs) and, for each, the Chat spaces connected to it. Only these spaces are read each day.
export async function GET() {
  return handle(async () => {
    const [live, links] = await Promise.all([listLiveProjects(), loadProjectSpaces()]);
    const byProject = new Map<string, Array<{ space: string; displayName: string | null }>>();
    for (const l of links) byProject.set(l.projectId, [...(byProject.get(l.projectId) ?? []), { space: l.space, displayName: l.displayName }]);
    return {
      liveProjects: live,
      targets: live.flatMap((p) => (byProject.get(p.id) ?? []).map((s) => ({ projectId: p.id, project: p.name, space: s.space, displayName: s.displayName }))),
    };
  });
}
