import { perLivePayments, type LiveProject, type Payment } from "./perLive";
import { ChatReport } from "@/models/chat-report";
import { Project } from "@/models/project";
import { TeamMember } from "@/models/team-member";

/**
 * The per-live commission (lib/projects/perLive.ts) of every Live Theme Design & Development and Preset Design & Development
 * project: who is on it (assigned, or reported on it: a theme project's new-theme reports on its theme, a preset project's linked
 * preset reports) and the month of its last report. Also returns the ids of the per-live people, whose hours are not priced.
 */
export async function loadPerLive(): Promise<{ payments: Payment[]; perLiveIds: Set<string> }> {
  const people = await TeamMember.find({ payModel: "per_live" }).select("perLiveTheme perLivePreset").lean<{ _id: unknown; perLiveTheme?: number | null; perLivePreset?: number | null }[]>();
  const perLiveIds = new Set(people.map((p) => String(p._id)));
  if (people.length === 0) return { payments: [], perLiveIds };

  const projects = await Project.find({ status: "live", type: { $in: ["theme_development", "preset_development", null] } })
    .select("themeId type members")
    .lean<{ _id: unknown; themeId: unknown; type?: string | null; members: { memberId: unknown }[] }[]>();
  const themeIds = projects.filter((p) => p.type !== "preset_development").map((p) => p.themeId);
  const presetIds = projects.filter((p) => p.type === "preset_development").map((p) => p._id);
  const reports = await ChatReport.find({
    status: "ok",
    memberId: { $ne: null },
    $or: [
      { kind: "theme", themeId: { $in: themeIds } },
      { kind: "preset", projectId: { $in: presetIds } },
    ],
  })
    .select("kind themeId projectId memberId date")
    .lean<{ kind: string; themeId: unknown; projectId: unknown; memberId: unknown; date: Date }[]>();

  const byTheme = new Map<string, typeof reports>();
  const byPreset = new Map<string, typeof reports>();
  for (const r of reports) {
    const map = r.kind === "theme" ? byTheme : byPreset;
    const key = String(r.kind === "theme" ? r.themeId : r.projectId);
    map.set(key, [...(map.get(key) ?? []), r]);
  }

  const live: LiveProject[] = projects.map((p) => {
    const preset = p.type === "preset_development";
    const own = (preset ? byPreset.get(String(p._id)) : byTheme.get(String(p.themeId))) ?? [];
    const last = own.reduce<Date | null>((max, r) => (!max || r.date > max ? r.date : max), null);
    return {
      id: String(p._id),
      themeId: String(p.themeId),
      kind: preset ? "preset" : "theme",
      people: new Set([...p.members.map((m) => String(m.memberId)), ...own.map((r) => String(r.memberId))]),
      month: last ? last.toISOString().slice(0, 7) : null,
    };
  });

  return {
    payments: perLivePayments(
      live,
      people.map((p) => ({ id: String(p._id), perLiveTheme: p.perLiveTheme ?? null, perLivePreset: p.perLivePreset ?? null }))
    ),
    perLiveIds,
  };
}
